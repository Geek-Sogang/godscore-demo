/**
 * src/application/hooks/useGodScore.ts
 * 갓생점수 통합 Hook
 *
 * [개선] featureWeights를 useRef 대신 godScoreStore에서 직접 수신
 *        → categoryWeights / featureWeights 모두 Store 단일 진실 소스(SSoT) 유지
 *        → simulateQuarterlyRetraining 결과도 즉시 Store에 반영
 */
import { useEffect } from 'react';
import {
  useGodScoreStore,
  selectCurrentScore,
  selectCurrentTier,
  selectBreakdown,
  selectSHAPValues,
} from '../stores/godScoreStore';
import { useMLEngine } from './useMLEngine';
import type { RawCategoryScores } from '../../domain/entities/GodScore';
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
  recalculate: (rawScores?: RawCategoryScores) => void;
  runQuarterlyRetraining: () => void;
  error: string | null;
}

export function useGodScore(userId: string): UseGodScoreReturn {
  const store = useGodScoreStore();

  // [개선] categoryWeights + featureWeights 모두 Store에서 전달 → ref 동기화 문제 제거
  const {
    result,
    isRunning,
    error: mlError,
    runEngine,
    simulateQuarterlyRetraining,
    currentWeights,
  } = useMLEngine(store.categoryWeights, store.featureWeights);

  // 마운트 시 Mock 데이터 시드 + 초기 계산
  useEffect(() => {
    if (!store.currentSnapshot) {
      store.seedMockData(userId);
    }
  }, [userId]);

  const recalculate = (rawScores?: RawCategoryScores) => {
    // ML 엔진 실행 (최신 Store 가중치 반영)
    runEngine({
      userId,
      ...(rawScores !== undefined ? { rawScores } : {}),
      quarterlyBaseScore: store.quarterlyBaseScore,
    });
    // Store 점수도 동기 갱신
    store.calculateScore(userId, rawScores);
  };

  const runQuarterlyRetraining = () => {
    const { newWeights } = simulateQuarterlyRetraining();
    // [개선] 재학습 결과를 Store에 즉시 반영 → 이후 모든 계산에 자동 적용
    store.updateWeights(newWeights, store.featureWeights);
    recalculate();
  };

  return {
    currentScore: selectCurrentScore(store),
    tier: selectCurrentTier(store),
    breakdown: selectBreakdown(store),
    shapValues: selectSHAPValues(store),
    scoreHistory: store.history.map(h => ({
      date: h.date,
      score: h.breakdown.totalScore,
    })),
    isCalculating: store.isCalculating || isRunning,
    confidence: result?.confidence ?? 0,
    topPositiveFeatures: result?.topPositiveFeatures ?? [],
    topNegativeFeatures: result?.topNegativeFeatures ?? [],
    currentWeights,
    recalculate,
    runQuarterlyRetraining,
    error: store.error ?? mlError,
  };
}
