/**
 * src/application/hooks/useGodScore.ts
 * 갓생점수 통합 Hook — FastAPI 연동 버전
 *
 * 3단계 변경:
 *   - recalculate: store.calculateScore (async FastAPI 호출) 위임
 *   - confidence / topFeatures: Store SHAP 값에서 파생
 *   - simulateQuarterlyRetraining: useMLEngine 유지 (클라이언트 노이즈)
 */
import type { FeatureVector } from '../../../types/featureKeys';
import { useEffect } from 'react';
import {
  useGodScoreStore,
  selectCurrentScore,
  selectCurrentTier,
  selectBreakdown,
  selectSHAPValues,
  selectIsCalculating,
  selectError,
} from '../stores/godScoreStore';
import { useMLEngine } from './useMLEngine';
import type { SHAPValue } from '../../../types/godScore';

export interface UseGodScoreReturn {
  // ── 현재 점수 ─────────────────────────────────
  currentScore: number;
  tier: ReturnType<typeof selectCurrentTier>;
  breakdown: ReturnType<typeof selectBreakdown>;
  shapValues: SHAPValue[];
  // ── 이력 ──────────────────────────────────────
  scoreHistory: Array<{ date: string; score: number }>;
  // ── ML 엔진 상태 ──────────────────────────────
  isCalculating: boolean;
  confidence: number;
  topPositiveFeatures: SHAPValue[];
  topNegativeFeatures: SHAPValue[];
  // ── 가중치 (Store SSoT) ───────────────────────
  currentWeights: ReturnType<typeof useMLEngine>['currentWeights'];
  // ── 액션 ──────────────────────────────────────
  recalculate: (features?: FeatureVector) => void;
  runQuarterlyRetraining: () => void;
  error: string | null;
}

export function useGodScore(userId: string): UseGodScoreReturn {
  const store = useGodScoreStore();

  // simulateQuarterlyRetraining 전용 — 재학습 노이즈 시뮬레이션
  const {
    simulateQuarterlyRetraining,
    currentWeights,
  } = useMLEngine(store.categoryWeights, store.featureWeights);

  // 마운트 시: 서버 최신 점수 로드 시도, 실패 시 Mock 데이터 폴백
  useEffect(() => {
    if (!store.currentSnapshot) {
      store.loadLatestScore(userId)
        .catch(() => store.seedMockData(userId));
    }
  }, [userId]);

  /**
   * 점수 재계산
   * features 없으면 서버가 Mock 피처로 처리 (데모 모드)
   */
  const recalculate = (features?: FeatureVector) => {
    store.calculateScore(userId, features);
  };

  const runQuarterlyRetraining = () => {
    const { newWeights } = simulateQuarterlyRetraining();
    store.updateWeights(newWeights, store.featureWeights);
    recalculate();
  };

  // SHAP 기반 파생 값
  const shapValues = selectSHAPValues(store);
  const sorted = [...shapValues].sort((a, b) => b.shapValue - a.shapValue);
  const topPositiveFeatures = sorted.filter(s => s.shapValue > 0).slice(0, 3);
  const topNegativeFeatures = sorted.filter(s => s.shapValue < 0).slice(-3).reverse();

  // 신뢰도: SHAP 분산이 낮을수록 일관된 예측
  const shapVariance = shapValues.length > 0
    ? shapValues.reduce((acc, s) => acc + s.shapValue ** 2, 0) / shapValues.length
    : 0;
  const confidence = parseFloat(
    Math.min(0.95, Math.max(0.70, 0.92 - shapVariance * 0.3)).toFixed(2),
  );

  return {
    currentScore:        selectCurrentScore(store),
    tier:                selectCurrentTier(store),
    breakdown:           selectBreakdown(store),
    shapValues,
    scoreHistory: store.history.map(h => ({
      date:  h.date,
      score: h.breakdown.totalScore,
    })),
    isCalculating:       selectIsCalculating(store),
    confidence:          shapValues.length > 0 ? confidence : 0,
    topPositiveFeatures,
    topNegativeFeatures,
    currentWeights,
    recalculate,
    runQuarterlyRetraining,
    error: selectError(store),
  };
}
