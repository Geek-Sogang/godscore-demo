/**
 * src/application/stores/godScoreStore.ts
 * 갓생스코어 Store — FastAPI 서버 연동 버전
 *
 * [수정] 백엔드 응답 필드명과 프론트 타입의 불일치 수정
 *   이전: total_score / fa / tier → 백엔드 응답에 없는 필드 → 모두 undefined
 *   이후: final_score / category_scores.fA / grade → 실제 백엔드 응답과 일치
 *
 * [수정] generateMockFeatures 키 오타 수정
 *   이전: a1_wake_time, a2_sleep_regularity (소문자, 다른 이름)
 *   이후: A1_wake_score, A2_sleep_score (백엔드 FEATURE_COLUMNS 와 정확히 일치)
 *
 * [수정] CalculateGodScoreRequest 에 없는 quarterly_base_score 필드 제거
 *
 * 응답 데이터 흐름:
 *   백엔드 engine.calculate() 반환값
 *   → GodScoreApiResponse 타입으로 수신
 *   → mapApiResponseToSnapshot() 로 GodScoreSnapshot 변환
 *   → Zustand store 저장
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  GodScoreSnapshot,
  GodScoreBreakdown,
  CategoryWeights,
  FeatureWeights,
  SHAPValue,
} from '../../../types/godScore';
import {
  INITIAL_CATEGORY_WEIGHTS,
  INITIAL_FEATURE_WEIGHTS,
  GOD_SCORE_TIER_TABLE,
  getTierByScore,
} from '../../../types/godScore';
import type { FeatureVector } from '../../../types/featureKeys';
import { FEATURE_KEYS, FEATURE_LABEL } from '../../../types/featureKeys';
import { api } from '../../infrastructure/api/apiClient';

// ── 백엔드 응답 타입 ─────────────────────────────────────
// 백엔드 godscore_engine.calculate() 의 실제 반환 구조와 1:1 매핑
// 변경 시 반드시 backend/app/services/godscore_engine.py 와 동기화할 것

/**
 * POST /api/v1/godscore/calculate 응답
 * godscore_engine.GodScoreEngine.calculate() 반환값 그대로
 */
interface GodScoreApiResponse {
  final_score:     number;          // S_final = 0.7×quarterly + 0.3×cumulative
  quarterly_score: number;          // XGBoost 추론 점수
  cumulative_score: number;         // 누적 이동평균 점수
  category_scores: {
    fA: number;                     // 생활 루틴 카테고리 점수 (0.0~1.0)
    fB: number;                     // 일·소득 카테고리 점수
    fC: number;                     // 소비 행동 카테고리 점수
    fD: number;                     // 개인 ESG 카테고리 점수
  };
  intra_weights: Record<string, number>;  // 카테고리 내 미션별 가중치
  grade:         string;            // 한국어 등급 ("새싹" | "성실" | "갓생" | "레전드")
  grade_emoji:   string;            // 등급 이모지
  shap: {
    [featureKey: string]: number | string[];  // 피처별 SHAP 값 + top_improvement_features
    top_improvement_features: string[];
  };
  estimated_rate_discount: number;  // 금리 인하 비율 (0.0~1.0)
  model_version: string;
  score_date:    string;            // "YYYY-MM-DD"
}

/**
 * GET /api/v1/godscore/latest 응답
 * Supabase godscores 테이블 컬럼 그대로
 */
interface GodScoreLatestApiResponse {
  score_date:       string;
  final_score:      number;
  quarterly_score:  number;
  cumulative_score: number;
  fa_score:         number | null;  // Supabase 컬럼명: fa_score (not fa)
  fb_score:         number | null;
  fc_score:         number | null;
  fd_score:         number | null;
  grade:            string;
  shap_values:      Record<string, unknown> | null;
  message?:         string;         // 점수 없을 때 메시지 필드
}

// ── Zustand Store 타입 ────────────────────────────────────

interface GodScoreState {
  currentSnapshot:    GodScoreSnapshot | null;
  history:            GodScoreSnapshot[];
  categoryWeights:    CategoryWeights;
  featureWeights:     FeatureWeights;
  quarterlyBaseScore: number;
  quarterlySettledAt: string | null;
  isCalculating:      boolean;
  error:              string | null;
}

interface GodScoreActions {
  calculateScore:    (userId: string, features?: FeatureVector) => Promise<void>;
  loadLatestScore:   (userId: string) => Promise<void>;
  settleQuarterlyScore: () => void;
  getSnapshotByDate: (date: string) => GodScoreSnapshot | undefined;
  updateWeights:     (newCategoryWeights: CategoryWeights, newFeatureWeights: FeatureWeights) => void;
  getTopSHAPFeatures: (limit?: number) => SHAPValue[];
  clearError:        () => void;
  seedMockData:      (userId: string) => void;
}

// ── 응답 변환 ─────────────────────────────────────────────

/**
 * 백엔드 calculate 응답 → GodScoreSnapshot 변환
 */
function mapCalculateToSnapshot(
  userId: string,
  res: GodScoreApiResponse,
  categoryWeights: CategoryWeights,
  featureWeights: FeatureWeights,
): GodScoreSnapshot {
  // SHAP 값 변환: {A1_wake_score: 12.3, ...} → SHAPValue[]
  const shapValues: SHAPValue[] = FEATURE_KEYS
    .filter(k => typeof res.shap[k] === 'number')
    .map(k => ({
      featureId:     k,
      featureName:   FEATURE_LABEL[k],
      shapValue:     res.shap[k] as number,
      baselineScore: 0,     // 백엔드에서 baseline을 별도 제공하지 않음
    }));

  const breakdown: GodScoreBreakdown = {
    fA:         parseFloat(((res.category_scores.fA ?? 0) * 100).toFixed(1)),
    fB:         parseFloat(((res.category_scores.fB ?? 0) * 100).toFixed(1)),
    fC:         parseFloat(((res.category_scores.fC ?? 0) * 100).toFixed(1)),
    fD:         parseFloat(((res.category_scores.fD ?? 0) * 100).toFixed(1)),
    totalScore: Math.round(res.final_score ?? 0),
  };

  return {
    id:                  `${userId}_${res.score_date}`,
    userId,
    date:                res.score_date,
    breakdown,
    weights:             categoryWeights,
    featureWeights,
    shapValues,
    tier:                getTierByScore(breakdown.totalScore),
    quarterlyWeight:     0.70,
    accumulativeWeight:  0.30,
    movingAvg90dScore:   Math.round(res.cumulative_score ?? 0),
    createdAt:           new Date().toISOString(),
  };
}

/**
 * Supabase godscores 테이블 행 → GodScoreSnapshot 변환
 */
function mapLatestToSnapshot(
  userId: string,
  res: GodScoreLatestApiResponse,
  categoryWeights: CategoryWeights,
  featureWeights: FeatureWeights,
): GodScoreSnapshot {
  const totalScore = Math.round(res.final_score ?? 0);

  // Supabase 컬럼명: fa_score (백엔드 응답: fA)
  const breakdown: GodScoreBreakdown = {
    fA:         parseFloat(((res.fa_score ?? 0) * 100).toFixed(1)),
    fB:         parseFloat(((res.fb_score ?? 0) * 100).toFixed(1)),
    fC:         parseFloat(((res.fc_score ?? 0) * 100).toFixed(1)),
    fD:         parseFloat(((res.fd_score ?? 0) * 100).toFixed(1)),
    totalScore,
  };

  // shap_values 는 DB에 JSON 저장 — 구조 동일하게 복원
  const shapValues: SHAPValue[] = [];
  if (res.shap_values && typeof res.shap_values === 'object') {
    for (const key of FEATURE_KEYS) {
      const val = (res.shap_values as Record<string, unknown>)[key];
      if (typeof val === 'number') {
        shapValues.push({
          featureId:     key,
          featureName:   FEATURE_LABEL[key],
          shapValue:     val,
          baselineScore: 0,
        });
      }
    }
  }

  return {
    id:                  `${userId}_${res.score_date}`,
    userId,
    date:                res.score_date,
    breakdown,
    weights:             categoryWeights,
    featureWeights,
    shapValues,
    tier:                getTierByScore(totalScore),
    quarterlyWeight:     0.70,
    accumulativeWeight:  0.30,
    movingAvg90dScore:   Math.round(res.cumulative_score ?? totalScore),
    createdAt:           new Date().toISOString(),
  };
}

// ── Mock 피처 생성 (오프라인 폴백용) ─────────────────────
/**
 * 타입-안전 Mock 피처 벡터.
 * 키 = FEATURE_KEYS 상수 (백엔드 FEATURE_COLUMNS 와 동일)
 * 이전 버그: a1_wake_time (소문자, 다른 이름) → 백엔드가 0.0으로 처리
 * 수정 후: A1_wake_score (대문자, 정확한 이름) → 백엔드 정상 처리
 */
function generateMockFeatures(): FeatureVector {
  const r = (lo: number, hi: number) => parseFloat((lo + Math.random() * (hi - lo)).toFixed(3));
  return {
    // fA: 생활 루틴 — 긱 워커 평균적으로 기상/수면 불규칙
    A1_wake_score:            r(0.55, 0.90),
    A2_sleep_score:           r(0.50, 0.85),
    A3_checkin_score:         r(0.65, 0.95),
    A4_mission_rate:          r(0.55, 0.90),
    // fB: 일·소득 — 변동성 중간 수준
    B1_portfolio_score:       r(0.40, 0.85),
    B2_income_stability:      r(0.50, 0.85),
    B3_income_predictability: r(0.50, 0.85),
    B4_work_completion:       r(0.40, 0.85),
    // fC: 소비 행동 — 충동 결제 억제 보통
    C1_spending_regularity:   r(0.50, 0.85),
    C2_impulse_control:       r(0.55, 0.90),
    C3_grocery_score:         r(0.45, 0.85),
    C4_balance_maintain:      r(0.50, 0.85),
    // fD: ESG — 상대적으로 낮음
    D1_health_score:          r(0.35, 0.80),
    D2_eco_score:             r(0.35, 0.80),
    D3_energy_score:          r(0.30, 0.75),
    D4_volunteer_score:       r(0.20, 0.70),
  };
}

// ── Store 구현 ────────────────────────────────────────────

export const useGodScoreStore = create<GodScoreState & GodScoreActions>()(
  immer((set, get) => ({
    currentSnapshot:    null,
    history:            [],
    categoryWeights:    INITIAL_CATEGORY_WEIGHTS,
    featureWeights:     INITIAL_FEATURE_WEIGHTS,
    quarterlyBaseScore: 0,
    quarterlySettledAt: null,
    isCalculating:      false,
    error:              null,

    /**
     * FastAPI /calculate 호출 → XGBoost 추론 + Supabase 저장
     * features 미전달 시 Mock 피처 사용 (데모 모드)
     */
    calculateScore: async (userId, features) => {
      if (get().isCalculating) return;
      set(state => { state.isCalculating = true; state.error = null; });

      try {
        const featInput = features ?? generateMockFeatures();

        // quarterly_base_score 는 백엔드 스키마에 없음 → 보내지 않음
        // 서버가 Supabase에서 직접 cumulative_score 조회
        const response = await api.post<GodScoreApiResponse>(
          '/api/v1/godscore/calculate',
          { features: featInput },
        );

        const snapshot = mapCalculateToSnapshot(
          userId,
          response,
          get().categoryWeights,
          get().featureWeights,
        );

        set(state => {
          state.currentSnapshot = snapshot;

          // 90일 이력 유지
          const today = response.score_date;
          const idx   = state.history.findIndex(h => h.date === today);
          if (idx >= 0) {
            state.history[idx] = snapshot;
          } else {
            state.history.push(snapshot);
            if (state.history.length > 90) {
              state.history.splice(0, state.history.length - 90);
            }
          }
          state.isCalculating = false;
        });

      } catch (err) {
        set(state => {
          state.error         = err instanceof Error ? err.message : '점수 계산 서버 오류';
          state.isCalculating = false;
        });
      }
    },

    /**
     * 서버 저장 최신 점수 로드 (앱 재시작 시 로컬 상태 복원)
     * 실패 시 로컬 캐시 유지 — graceful degradation
     */
    loadLatestScore: async (userId) => {
      set(state => { state.isCalculating = true; state.error = null; });
      try {
        const response = await api.get<GodScoreLatestApiResponse>(
          '/api/v1/godscore/latest',
        );

        // 점수 없음 응답 (message 필드만 있는 경우)
        if (!response.final_score) {
          set(state => { state.isCalculating = false; });
          return;
        }

        const snapshot = mapLatestToSnapshot(
          userId,
          response,
          get().categoryWeights,
          get().featureWeights,
        );

        set(state => {
          state.currentSnapshot = snapshot;
          state.isCalculating   = false;
        });
      } catch (err) {
        // 서버 오류 시 로컬 상태 유지 (graceful degradation)
        set(state => {
          state.error         = err instanceof Error ? err.message : '점수 로드 실패';
          state.isCalculating = false;
        });
      }
    },

    /**
     * 분기 정산: 현재 점수를 quarterlyBaseScore 로 확정
     * 실서비스: Celery Beat 분기 1회 호출
     */
    settleQuarterlyScore: () => {
      const snap = get().currentSnapshot;
      if (!snap) return;
      set(state => {
        state.quarterlyBaseScore = snap.breakdown.totalScore;
        state.quarterlySettledAt = new Date().toISOString().slice(0, 10);
      });
    },

    getSnapshotByDate: date =>
      get().history.find(h => h.date === date),

    updateWeights: (newCat, newFeat) =>
      set(state => {
        state.categoryWeights = newCat;
        state.featureWeights  = newFeat;
      }),

    getTopSHAPFeatures: (limit = 5) => {
      const snap = get().currentSnapshot;
      if (!snap) return [];
      return [...snap.shapValues]
        .sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue))
        .slice(0, limit);
    },

    clearError: () => set(state => { state.error = null; }),

    /**
     * Mock 데이터 시딩 (오프라인 시연 / Storybook용)
     */
    seedMockData: (userId) => {
      const catW  = get().categoryWeights;
      const featW = get().featureWeights;
      const history: GodScoreSnapshot[] = [];

      for (let i = 6; i >= 0; i--) {
        const dateStr    = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
        const totalScore = Math.round(400 + i * 30 + Math.random() * 40);
        const snapshot: GodScoreSnapshot = {
          id:                  `${userId}_${dateStr}`,
          userId,
          date:                dateStr,
          breakdown: {
            fA: 60 + Math.random() * 30,
            fB: 55 + Math.random() * 35,
            fC: 50 + Math.random() * 40,
            fD: 40 + Math.random() * 45,
            totalScore,
          },
          weights:              catW,
          featureWeights:       featW,
          shapValues:           [],
          tier:                 getTierByScore(totalScore),
          quarterlyWeight:      0.70,
          accumulativeWeight:   0.30,
          movingAvg90dScore:    totalScore - 10,
          createdAt:            new Date(Date.now() - i * 86_400_000).toISOString(),
        };
        history.push(snapshot);
      }

      set(state => {
        state.history            = history;
        state.currentSnapshot    = history[history.length - 1];
        state.quarterlyBaseScore = history[0].breakdown.totalScore;
        state.quarterlySettledAt = history[0].date;
      });
    },
  })),
);

// ── Selectors ─────────────────────────────────────────────
export const selectCurrentScore     = (s: GodScoreState) =>
  s.currentSnapshot?.breakdown.totalScore ?? 0;
export const selectCurrentTier      = (s: GodScoreState) =>
  s.currentSnapshot?.tier ?? GOD_SCORE_TIER_TABLE[0];
export const selectBreakdown        = (s: GodScoreState) =>
  s.currentSnapshot?.breakdown ?? null;
export const selectSHAPValues       = (s: GodScoreState) =>
  s.currentSnapshot?.shapValues ?? [];
export const selectQuarterlyBase    = (s: GodScoreState) =>
  s.quarterlyBaseScore;
export const selectQuarterlySettled = (s: GodScoreState) =>
  s.quarterlySettledAt;
export const selectIsCalculating    = (s: GodScoreState) =>
  s.isCalculating;
export const selectError            = (s: GodScoreState) =>
  s.error;
