/**
 * src/application/hooks/useMLEngine.ts
 * Mock ML Engine Hook
 *
 * 기획서 12p, 30p 기반:
 *  - 트리 기반 모델(XGBoost) 구조 모사
 *  - 피처별 가중치(wA~wD) 적용한 실시간 점수 산출
 *  - SHAP 값 반환 (설명 가능한 AI)
 *  - 분기 재학습 시뮬레이션 (Mock weight tuning)
 *
 * 실서비스: FastAPI ML 서버 호출 → 여기서는 완전 클라이언트 사이드 구현
 */
import { useState, useCallback, useRef } from 'react';
import { executeCalculateGodScore } from '../../../src/domain/usecases/CalculateGodScore';
import { generateMockRawScores, type RawCategoryScores } from '../../../src/domain/entities/GodScore';
import type { GodScoreBreakdown, SHAPValue, CategoryWeights, FeatureWeights } from '../../../types/godScore';
import {
  INITIAL_CATEGORY_WEIGHTS,
  INITIAL_FEATURE_WEIGHTS,
} from '../../../types/godScore';

export interface MLEngineInput {
  userId: string;
  rawScores?: RawCategoryScores;
  quarterlyBaseScore?: number;
}

export interface MLEngineOutput {
  breakdown: GodScoreBreakdown;
  shapValues: SHAPValue[];
  topPositiveFeatures: SHAPValue[];   // 점수에 긍정 기여 상위 3개
  topNegativeFeatures: SHAPValue[];   // 점수에 부정 기여 상위 3개
  confidence: number;                 // 예측 신뢰도 (Mock: 0.75~0.95)
  calculatedAt: string;
}

export interface UseMLEngineReturn {
  result: MLEngineOutput | null;
  isRunning: boolean;
  error: string | null;
  runEngine: (input: MLEngineInput) => void;
  /** 분기 재학습 시뮬레이션 — 소량 노이즈로 가중치 미세 조정 */
  simulateQuarterlyRetraining: () => { newWeights: CategoryWeights; delta: CategoryWeights };
  currentWeights: CategoryWeights;
}

export function useMLEngine(
  initialCategoryWeights: CategoryWeights = INITIAL_CATEGORY_WEIGHTS,
  initialFeatureWeights: FeatureWeights = INITIAL_FEATURE_WEIGHTS,
): UseMLEngineReturn {
  const [result, setResult] = useState<MLEngineOutput | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryWeights, setCategoryWeights] = useState(initialCategoryWeights);
  const featureWeightsRef = useRef<FeatureWeights>(initialFeatureWeights);

  const runEngine = useCallback((input: MLEngineInput) => {
    setIsRunning(true);
    setError(null);

    try {
      const rawScores = input.rawScores ?? generateMockRawScores(0.6);
      const today = new Date().toISOString().slice(0, 10);

      const { snapshot, shapValues } = executeCalculateGodScore({
        userId: input.userId,
        date: today,
        rawScores,
        quarterlyBaseScore: input.quarterlyBaseScore ?? 0,
        categoryWeights,
        featureWeights: featureWeightsRef.current,
      });

      // SHAP 정렬: 양수(상승 기여) / 음수(하락 기여) 분리
      const sorted = [...shapValues].sort((a, b) => b.shapValue - a.shapValue);
      const topPositiveFeatures = sorted.filter(s => s.shapValue > 0).slice(0, 3);
      const topNegativeFeatures = sorted.filter(s => s.shapValue < 0).slice(-3).reverse();

      // Mock 신뢰도: 완료된 미션 수 기반 (데이터 많을수록 신뢰도↑)
      const completedCount = rawScores
        ? Object.values(rawScores).filter(v => v > 50).length
        : 8;
      const confidence = Math.min(0.95, 0.70 + completedCount * 0.02);

      setResult({
        breakdown: snapshot.breakdown,
        shapValues,
        topPositiveFeatures,
        topNegativeFeatures,
        confidence: parseFloat(confidence.toFixed(2)),
        calculatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ML 엔진 오류');
    } finally {
      setIsRunning(false);
    }
  }, [categoryWeights]);

  /**
   * 분기 재학습 시뮬레이션
   * 실서비스: XGBoost로 연체 여부 ~ 행동 데이터 상관관계 재학습
   * Mock: 현재 가중치에 ±0.02 범위 노이즈 적용 후 정규화
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
