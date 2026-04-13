/**
 * src/application/stores/godScoreStore.ts
 * 갓생점수 Zustand Store
 *
 * 관리 상태:
 *  - 현재 갓생점수 스냅샷 (breakdown, tier, SHAP)
 *  - 점수 이력 (최근 90일)
 *  - 가중치 (분기 재학습 반영)
 *
 * immer 미들웨어로 불변성 관리
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GodScoreSnapshot, CategoryWeights, FeatureWeights, SHAPValue } from '../../../types/godScore';
import {
  INITIAL_CATEGORY_WEIGHTS,
  INITIAL_FEATURE_WEIGHTS,
  GOD_SCORE_TIER_TABLE,
  getTierByScore,
} from '../../../types/godScore';
import { executeCalculateGodScore } from '../../domain/usecases/CalculateGodScore';
import { generateMockRawScores } from '../../domain/entities/GodScore';
import type { RawCategoryScores } from '../../domain/entities/GodScore';

// ── State 타입 ──────────────────────────────────────────
interface GodScoreState {
  /** 현재 갓생점수 스냅샷 */
  currentSnapshot: GodScoreSnapshot | null;
  /** 최근 90일 스냅샷 이력 */
  history: GodScoreSnapshot[];
  /** 현재 적용 중인 카테고리 가중치 */
  categoryWeights: CategoryWeights;
  /** 현재 적용 중인 피처별 가중치 */
  featureWeights: FeatureWeights;
  /** 이전 누적 점수 (분기·누적 가중 합산용) */
  historicalScore: number;
  /** 로딩 상태 */
  isCalculating: boolean;
  /** 에러 메시지 */
  error: string | null;
}

// ── Actions 타입 ────────────────────────────────────────
interface GodScoreActions {
  /**
   * 갓생점수 계산 및 상태 갱신
   * rawScores가 없으면 Mock 데이터로 계산
   */
  calculateScore: (userId: string, rawScores?: RawCategoryScores) => void;
  /** 이력에서 특정 날짜 스냅샷 조회 */
  getSnapshotByDate: (date: string) => GodScoreSnapshot | undefined;
  /** 분기 재학습 결과로 가중치 갱신 (XGBoost 재학습 후 호출) */
  updateWeights: (newCategoryWeights: CategoryWeights, newFeatureWeights: FeatureWeights) => void;
  /** SHAP 값 기준 상위 피처 조회 (기여도 내림차순) */
  getTopSHAPFeatures: (limit?: number) => SHAPValue[];
  /** 에러 초기화 */
  clearError: () => void;
  /** Mock 데이터로 초기 상태 시드 (4단계 테스트용) */
  seedMockData: (userId: string) => void;
}

// ── Store ───────────────────────────────────────────────
export const useGodScoreStore = create<GodScoreState & GodScoreActions>()(
  immer((set, get) => ({
    // 초기 상태
    currentSnapshot: null,
    history: [],
    categoryWeights: INITIAL_CATEGORY_WEIGHTS,
    featureWeights: INITIAL_FEATURE_WEIGHTS,
    historicalScore: 0,
    isCalculating: false,
    error: null,

    // ── Actions ─────────────────────────────────────────
    calculateScore: (userId, rawScores) => {
      set(state => { state.isCalculating = true; state.error = null; });

      try {
        const scores = rawScores ?? generateMockRawScores(0.6);
        const today = new Date().toISOString().slice(0, 10);
        const { snapshot } = executeCalculateGodScore({
          userId,
          date: today,
          rawScores: scores,
          historicalScore: get().historicalScore || undefined,
          categoryWeights: get().categoryWeights,
          featureWeights: get().featureWeights,
        });

        set(state => {
          state.currentSnapshot = snapshot;
          state.historicalScore = snapshot.breakdown.totalScore;
          // 이력: 같은 날짜 덮어쓰기, 없으면 추가
          const idx = state.history.findIndex(h => h.date === today);
          if (idx >= 0) {
            state.history[idx] = snapshot;
          } else {
            state.history.push(snapshot);
            // 90일 초과분 제거
            if (state.history.length > 90) {
              state.history.splice(0, state.history.length - 90);
            }
          }
          state.isCalculating = false;
        });
      } catch (err) {
        set(state => {
          state.error = err instanceof Error ? err.message : '점수 계산 오류';
          state.isCalculating = false;
        });
      }
    },

    getSnapshotByDate: (date) => {
      return get().history.find(h => h.date === date);
    },

    updateWeights: (newCategoryWeights, newFeatureWeights) => {
      set(state => {
        state.categoryWeights = newCategoryWeights;
        state.featureWeights = newFeatureWeights;
      });
    },

    getTopSHAPFeatures: (limit = 5) => {
      const snap = get().currentSnapshot;
      if (!snap) return [];
      return [...snap.shapValues]
        .sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue))
        .slice(0, limit);
    },

    clearError: () => set(state => { state.error = null; }),

    seedMockData: (userId) => {
      // 최근 7일 Mock 이력 생성
      const weights = get().categoryWeights;
      const featWeights = get().featureWeights;
      const history: GodScoreSnapshot[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        const seed = 0.45 + i * 0.03; // 점진적 상승 패턴
        const { snapshot } = executeCalculateGodScore({
          userId,
          date,
          rawScores: generateMockRawScores(seed),
          categoryWeights: weights,
          featureWeights: featWeights,
        });
        history.push(snapshot);
      }
      set(state => {
        state.history = history;
        state.currentSnapshot = history[history.length - 1];
        state.historicalScore = history[history.length - 1].breakdown.totalScore;
      });
    },
  })),
);

// ── Selector 헬퍼 (리렌더 최적화용) ──────────────────────
export const selectCurrentScore = (s: GodScoreState) =>
  s.currentSnapshot?.breakdown.totalScore ?? 0;

export const selectCurrentTier = (s: GodScoreState) =>
  s.currentSnapshot?.tier ?? GOD_SCORE_TIER_TABLE[0];

export const selectBreakdown = (s: GodScoreState) =>
  s.currentSnapshot?.breakdown ?? null;

export const selectSHAPValues = (s: GodScoreState) =>
  s.currentSnapshot?.shapValues ?? [];
