/**
 * src/application/stores/godScoreStore.ts
 *
 * [수정] EMA 왜곡 수정
 *   기존: historicalScore를 매일 totalScore로 덮어써 EMA로 변질
 *   수정: quarterlyBaseScore — 분기 정산 시점에만 갱신되는 고정 스냅샷
 *         매일 calculateScore() 호출 시 quarterlyBaseScore는 불변
 *
 *   분기 정산 흐름:
 *     1. Celery Beat 분기 1회 → settleQuarterlyScore() 호출
 *     2. 현재 totalScore → quarterlyBaseScore로 확정
 *     3. 이후 매일 계산: S = 0.7×S_daily + 0.3×quarterlyBaseScore (고정)
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  GodScoreSnapshot,
  CategoryWeights,
  FeatureWeights,
  SHAPValue,
} from '../../../types/godScore';
import {
  INITIAL_CATEGORY_WEIGHTS,
  INITIAL_FEATURE_WEIGHTS,
  GOD_SCORE_TIER_TABLE,
} from '../../../types/godScore';
import { executeCalculateGodScore } from '../../domain/usecases/CalculateGodScore';
import { generateMockRawScores } from '../../domain/entities/GodScore';
import type { RawCategoryScores } from '../../domain/entities/GodScore';

interface GodScoreState {
  currentSnapshot: GodScoreSnapshot | null;
  history: GodScoreSnapshot[];
  categoryWeights: CategoryWeights;
  featureWeights: FeatureWeights;
  /**
   * [수정] 분기 정산 시점에 고정된 베이스 점수
   * 매일 calculateScore()에서 참조하되 변경하지 않음
   * settleQuarterlyScore() 에서만 갱신
   */
  quarterlyBaseScore: number;
  /** 현재 분기 정산 날짜 (YYYY-MM-DD) */
  quarterlySettledAt: string | null;
  isCalculating: boolean;
  error: string | null;
}

interface GodScoreActions {
  calculateScore: (userId: string, rawScores?: RawCategoryScores) => void;
  /**
   * [신규] 분기 정산 액션
   * 현재 점수를 quarterlyBaseScore로 확정 — 분기 1회 Celery Beat에서 호출
   */
  settleQuarterlyScore: () => void;
  getSnapshotByDate: (date: string) => GodScoreSnapshot | undefined;
  updateWeights: (
    newCategoryWeights: CategoryWeights,
    newFeatureWeights: FeatureWeights,
  ) => void;
  getTopSHAPFeatures: (limit?: number) => SHAPValue[];
  clearError: () => void;
  seedMockData: (userId: string) => void;
}

export const useGodScoreStore = create<GodScoreState & GodScoreActions>()(
  immer((set, get) => ({
    currentSnapshot:    null,
    history:            [],
    categoryWeights:    INITIAL_CATEGORY_WEIGHTS,
    featureWeights:     INITIAL_FEATURE_WEIGHTS,
    quarterlyBaseScore: 0,       // 첫 분기: 0 → undefined 처리로 일일 점수 자체 사용
    quarterlySettledAt: null,
    isCalculating:      false,
    error:              null,

    calculateScore: (userId, rawScores) => {
      // Race Condition 가드: 이미 계산 중이면 무시
      if (get().isCalculating) return;

      set(state => { state.isCalculating = true; state.error = null; });
      try {
        const scores = rawScores ?? generateMockRawScores(0.6);
        const today  = new Date().toISOString().slice(0, 10);
        const base   = get().quarterlyBaseScore > 0
          ? get().quarterlyBaseScore
          : undefined; // 첫 분기: base 없음 → 일일 점수 그대로 사용

        const { snapshot } = executeCalculateGodScore({
          userId,
          date: today,
          rawScores: scores,
          quarterlyBaseScore: base ?? 0, // [수정] historicalScore → quarterlyBaseScore, undefined 방지
          categoryWeights: get().categoryWeights,
          featureWeights:  get().featureWeights,
        });

        set(state => {
          state.currentSnapshot = snapshot;
          // [수정] quarterlyBaseScore 갱신 없음 — 분기 내 불변
          const idx = state.history.findIndex(h => h.date === today);
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
          state.error       = err instanceof Error ? err.message : '점수 계산 오류';
          state.isCalculating = false;
        });
      }
    },

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

    seedMockData: (userId) => {
      const catW  = get().categoryWeights;
      const featW = get().featureWeights;
      const history: GodScoreSnapshot[] = [];
      // 최초 분기 베이스: 7일 전 점수로 설정 (Mock)
      const baseSnap = executeCalculateGodScore({
        userId, date: '2026-01-01',
        rawScores: generateMockRawScores(0.45),
        categoryWeights: catW, featureWeights: featW,
      });
      const quarterlyBase = baseSnap.snapshot.breakdown.totalScore;

      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        const seed = 0.45 + i * 0.03;
        const { snapshot } = executeCalculateGodScore({
          userId, date,
          rawScores: generateMockRawScores(seed),
          quarterlyBaseScore: quarterlyBase,   // [수정] 동일한 분기 베이스 참조
          categoryWeights: catW, featureWeights: featW,
        });
        history.push(snapshot);
      }
      set(state => {
        state.history            = history;
        state.currentSnapshot    = history[history.length - 1];
        state.quarterlyBaseScore = quarterlyBase;
        state.quarterlySettledAt = '2026-01-01';
      });
    },
  })),
);

// ── Selectors ────────────────────────────────────────────────────────
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
