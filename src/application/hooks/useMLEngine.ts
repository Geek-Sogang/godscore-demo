/**
 * src/application/hooks/useMLEngine.ts
 * ML 엔진 Hook — FastAPI 서버 연동 버전
 *
 * 3단계 풀스택 전환:
 *   이전: 클라이언트 사이드 XGBoost 시뮬레이션
 *   이후: FastAPI POST /api/v1/godscore/calculate 호출
 *         서버에서 실제 XGBoost + SHAP 처리 후 결과 반환
 */
import { useState, useCallback } from 'react';
import { api } from '../../infrastructure/api/apiClient';
import type {
  GodScoreBreakdown,
  SHAPValue,
  CategoryWeights,
  FeatureWeights,
} from '../../../types/godScore';
import { INITIAL_CATEGORY_WEIGHTS, INITIAL_FEATURE_WEIGHTS } from '../../../types/godScore';

// ── FastAPI 요청/응답 타입 ──────────────────────────────────

/** FastAPI GodScoreFeatures 스키마 (16개 피처, 각 0.0~1.0) */
interface GodScoreFeatures {
  a1_wake_time: number;           // A1: 기상 인증 (이른 기상일수록 높음)
  a2_sleep_regularity: number;    // A2: 수면 규칙성
  a3_app_attendance: number;      // A3: 앱 출석 일관성
  a4_mission_rate: number;        // A4: 미션 달성률
  b1_portfolio_update: number;    // B1: 포트폴리오 업데이트
  b2_income_volatility: number;   // B2: 수입 변동성 (낮을수록 안정)
  b3_income_stability: number;    // B3: 수입 안정성 지수
  b4_work_completion: number;     // B4: 업무 완료 인증
  c1_spending_pattern: number;    // C1: 소비 패턴 규칙성
  c2_impulse_purchase: number;    // C2: 충동 결제 억제 (낮을수록 좋음 → 역정규화)
  c3_grocery_purchase: number;    // C3: 식료품 구매 인증
  c4_balance_maintenance: number; // C4: 잔고 유지 여부
  d1_exercise: number;            // D1: 운동·자기관리
  d2_eco_transport: number;       // D2: 대중교통·친환경 소비
  d3_energy_saving: number;       // D3: 에너지 절약 미션
  d4_volunteer: number;           // D4: 봉사·기부 활동
}

/** FastAPI /calculate 응답 스키마 */
interface GodScoreCalculateResponse {
  user_id: string;
  score_date: string;
  total_score: number;
  quarterly_score: number;
  cumulative_score: number;
  fa: number;
  fb: number;
  fc: number;
  fd: number;
  weights: { wA: number; wB: number; wC: number; wD: number };
  shap_values: Array<{
    feature_id: string;
    feature_name: string;
    shap_value: number;
    baseline_score: number;
  }>;
  tier: string;
  calculated_at: string;
}

// ── 공개 인터페이스 ────────────────────────────────────────

export interface MLEngineInput {
  userId: string;
  /** 피처값 오버라이드 (없으면 Mock 기본값 사용) */
  features?: Partial<GodScoreFeatures>;
  quarterlyBaseScore?: number;
}

export interface MLEngineOutput {
  breakdown: GodScoreBreakdown;
  shapValues: SHAPValue[];
  topPositiveFeatures: SHAPValue[];   // 점수에 긍정 기여 상위 3개
  topNegativeFeatures: SHAPValue[];   // 점수에 부정 기여 상위 3개
  confidence: number;                 // 예측 신뢰도 (0.0~1.0)
  calculatedAt: string;
}

export interface UseMLEngineReturn {
  result: MLEngineOutput | null;
  isRunning: boolean;
  error: string | null;
  runEngine: (input: MLEngineInput) => Promise<void>;
  /** 분기 재학습 시뮬레이션 (클라이언트 노이즈 기반 — 실서비스: Celery Beat) */
  simulateQuarterlyRetraining: () => { newWeights: CategoryWeights; delta: CategoryWeights };
  currentWeights: CategoryWeights;
}

// ── Mock 피처 생성 ─────────────────────────────────────────
/**
 * 실서비스에서는 OS SDK / HealthKit / 마이데이터 API 실측값 사용.
 * 현재: 합리적 범위의 Mock 랜덤값으로 대체.
 */
function generateDefaultFeatures(): GodScoreFeatures {
  const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  return {
    a1_wake_time:            rand(0.55, 0.90),
    a2_sleep_regularity:     rand(0.50, 0.90),
    a3_app_attendance:       rand(0.65, 0.95),
    a4_mission_rate:         rand(0.55, 0.90),
    b1_portfolio_update:     rand(0.40, 0.85),
    b2_income_volatility:    rand(0.50, 0.85),
    b3_income_stability:     rand(0.50, 0.85),
    b4_work_completion:      rand(0.40, 0.85),
    c1_spending_pattern:     rand(0.50, 0.85),
    c2_impulse_purchase:     rand(0.55, 0.90),
    c3_grocery_purchase:     rand(0.45, 0.85),
    c4_balance_maintenance:  rand(0.50, 0.85),
    d1_exercise:             rand(0.35, 0.80),
    d2_eco_transport:        rand(0.35, 0.80),
    d3_energy_saving:        rand(0.30, 0.75),
    d4_volunteer:            rand(0.20, 0.70),
  };
}

// ── Hook 구현 ──────────────────────────────────────────────

export function useMLEngine(
  initialCategoryWeights: CategoryWeights = INITIAL_CATEGORY_WEIGHTS,
  _initialFeatureWeights: FeatureWeights = INITIAL_FEATURE_WEIGHTS,
): UseMLEngineReturn {
  const [result, setResult]             = useState<MLEngineOutput | null>(null);
  const [isRunning, setIsRunning]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [categoryWeights, setCategoryWeights] = useState(initialCategoryWeights);

  /**
   * FastAPI ML 서버 호출
   * POST /api/v1/godscore/calculate → XGBoost 추론 + SHAP 반환
   */
  const runEngine = useCallback(async (input: MLEngineInput): Promise<void> => {
    setIsRunning(true);
    setError(null);

    try {
      // 기본 Mock 피처에 사용자 입력값 병합
      const features: GodScoreFeatures = {
        ...generateDefaultFeatures(),
        ...(input.features ?? {}),
      };

      // FastAPI 호출
      const response = await api.post<GodScoreCalculateResponse>(
        '/api/v1/godscore/calculate',
        {
          features,
          quarterly_base_score: input.quarterlyBaseScore ?? 0,
        },
      );

      // 서버 반환 가중치로 로컬 상태 업데이트
      if (response.weights) {
        setCategoryWeights({
          wA: response.weights.wA,
          wB: response.weights.wB,
          wC: response.weights.wC,
          wD: response.weights.wD,
        });
      }

      // SHAP 값 변환 (서버 snake_case → 클라이언트 camelCase)
      const shapValues: SHAPValue[] = (response.shap_values ?? []).map(s => ({
        featureId:     s.feature_id,
        featureName:   s.feature_name,
        shapValue:     s.shap_value,
        baselineScore: s.baseline_score,
      }));

      const sorted = [...shapValues].sort((a, b) => b.shapValue - a.shapValue);
      const topPositiveFeatures = sorted.filter(s => s.shapValue > 0).slice(0, 3);
      const topNegativeFeatures = sorted.filter(s => s.shapValue < 0).slice(-3).reverse();

      // 카테고리 점수: 서버 반환값은 0~1 정규화 → 화면 표시용 0~100 변환
      const breakdown: GodScoreBreakdown = {
        fA: parseFloat((response.fa * 100).toFixed(1)),
        fB: parseFloat((response.fb * 100).toFixed(1)),
        fC: parseFloat((response.fc * 100).toFixed(1)),
        fD: parseFloat((response.fd * 100).toFixed(1)),
        totalScore: Math.round(response.total_score),
      };

      // 신뢰도: SHAP 분산이 낮을수록 일관된 예측 → 높은 신뢰도
      const shapVariance = shapValues.length > 0
        ? shapValues.reduce((acc, s) => acc + s.shapValue ** 2, 0) / shapValues.length
        : 0;
      const confidence = parseFloat(
        Math.min(0.95, Math.max(0.70, 0.92 - shapVariance * 0.3)).toFixed(2),
      );

      setResult({
        breakdown,
        shapValues,
        topPositiveFeatures,
        topNegativeFeatures,
        confidence,
        calculatedAt: response.calculated_at ?? new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ML 서버 연결 오류');
    } finally {
      setIsRunning(false);
    }
  }, []);

  /**
   * 분기 재학습 시뮬레이션
   * 실서비스: Celery Beat → XGBoost 재학습 → GET /api/v1/godscore/weights 로 수신
   * Mock: 현재 가중치에 ±0.02 노이즈 적용 후 정규화
   */
  const simulateQuarterlyRetraining = useCallback(() => {
    const noise = () => (Math.random() - 0.5) * 0.04;
    const raw = {
      wA: Math.max(0.05, categoryWeights.wA + noise()),
      wB: Math.max(0.05, categoryWeights.wB + noise()),
      wC: Math.max(0.05, categoryWeights.wC + noise()),
      wD: Math.max(0.05, categoryWeights.wD + noise()),
    };
    const total = raw.wA + raw.wB + raw.wC + raw.wD;
    const newWeights: CategoryWeights = {
      wA: parseFloat((raw.wA / total).toFixed(4)),
      wB: parseFloat((raw.wB / total).toFixed(4)),
      wC: parseFloat((raw.wC / total).toFixed(4)),
      wD: parseFloat((raw.wD / total).toFixed(4)),
    };
    const delta: CategoryWeights = {
      wA: parseFloat((newWeights.wA - categoryWeights.wA).toFixed(4)),
      wB: parseFloat((newWeights.wB - categoryWeights.wB).toFixed(4)),
      wC: parseFloat((newWeights.wC - categoryWeights.wC).toFixed(4)),
      wD: parseFloat((newWeights.wD - categoryWeights.wD).toFixed(4)),
    };
    setCategoryWeights(newWeights);
    return { newWeights, delta };
  }, [categoryWeights]);

  return {
    result,
    isRunning,
    error,
    runEngine,
    simulateQuarterlyRetraining,
    currentWeights: categoryWeights,
  };
}
