/**
 * src/application/stores/godScoreStore.ts
 * 갓생스코어 Store — FastAPI 서버 연동 버전
 *
 * 3단계 풀스택 전환:
 *   이전: 클라이언트 사이드 executeCalculateGodScore() 직접 호출
 *   이후: FastAPI POST /api/v1/godscore/calculate 비동기 호출
 *         서버에서 XGBoost + SHAP + Supabase 저장 일괄 처리
 *
 * 분기/누적 반영:
 *   S_final = 0.7 × S_quarterly + 0.3 × S_cumulative
 *   - S_quarterly: 당일 XGBoost 추론값
 *   - S_cumulative: Supabase godscores 테이블 누적 이동평균
 *   - quarterlyBaseScore: 분기 정산 시점 고정 스냅샷 (서버에서 관리)
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
import { api } from '../../infrastructure/api/apiClient';

// ── FastAPI 응답 타입 ─────────────────────────────────────

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

interface GodScoreLatestResponse {
  score_date: string;
  total_score: number;
  quarterly_score: number;
  cumulative_score: number;
  fa: number;
  fb: number;
  fc: number;
  fd: number;
  tier: string;
  shap_values: Array<{
    feature_id: string;
    feature_name: string;
    shap_value: number;
    baseline_score: number;
  }> | null;
}

// ── Zustand Store 타입 ────────────────────────────────────

interface GodScoreState {
  currentSnapshot: GodScoreSnapshot | null;
  history: GodScoreSnapshot[];
  categoryWeights: CategoryWeights;
  featureWeights: FeatureWeights;
  /**
   * 분기 정산 시점에 고정된 베이스 점수.
   * settleQuarterlyScore() 에서만 갱신 — calculateScore() 에서는 불변.
   */
  quarterlyBaseScore: number;
  quarterlySettledAt: string | null;
  isCalculating: boolean;
  error: string | null;
}

interface GodScoreActions {
  /** FastAPI /calculate 호출 → 서버 XGBoost 추론 */
  calculateScore: (userId: string, features?: Record<string, number>) => Promise<void>;
  /** 서버에서 최신 저장 점수 로드 */
  loadLatestScore: (userId: string) => Promise<void>;
  /** 분기 정산 — 현재 점수를 quarterlyBaseScore로 확정 */
  settleQuarterlyScore: () => void;
  getSnapshotByDate: (date: string) => GodScoreSnapshot | undefined;
  updateWeights: (newCategoryWeights: CategoryWeights, newFeatureWeights: FeatureWeights) => void;
  getTopSHAPFeatures: (limit?: number) => SHAPValue[];
  clearError: () => void;
  /** Mock 시딩 (오프라인 시연용) */
  seedMockData: (userId: string) => void;
}

// ── 응답 변환 유틸 ────────────────────────────────────────

function buildSnapshot(
  userId: string,
  response: GodScoreCalculateResponse | GodScoreLatestResponse,
  categoryWeights: CategoryWeights,
  featureWeights: FeatureWeights,
): GodScoreSnapshot {
  const shapValues: SHAPValue[] = (response.shap_values ?? []).map(s => ({
    featureId:     s.feature_id,
    featureName:   s.feature_name,
    shapValue:     s.shap_value,
    baselineScore: s.baseline_score,
  }));

  const breakdown: GodScoreBreakdown = {
    fA:         parseFloat((response.fa * 100).toFixed(1)),
    fB:         parseFloat((response.fb * 100).toFixed(1)),
    fC:         parseFloat((response.fc * 100).toFixed(1)),
    fD:         parseFloat((response.fd * 100).toFixed(1)),
    totalScore: Math.round(response.total_score),
  };

  const tier = getTierByScore(breakdown.totalScore);

  return {
    id:               `${userId}_${response.score_date}`,
    userId,
    date:             response.score_date,
    breakdown,
    weights:          categoryWeights,
    featureWeights,
    shapValues,
    tier,
    quarterlyWeight:  0.70,
    accumulativeWeight: 0.30,
    movingAvg90dScore: Math.round(response.cumulative_score),
    createdAt:        new Date().toISOString(),
  };
}

// ── Mock 피처 (오프라인 폴백용) ───────────────────────────
function generateMockFeatures(): Record<string, number> {
  const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  return {
    a1_wake_time:            r(0.55, 0.90),
    a2_sleep_regularity:     r(0.50, 0.90),
    a3_app_attendance:       r(0.65, 0.95),
    a4_mission_rate:         r(0.55, 0.90),
    b1_portfolio_update:     r(0.40, 0.85),
    b2_income_volatility:    r(0.50, 0.85),
    b3_income_stability:     r(0.50, 0.85),
    b4_work_completion:      r(0.40, 0.85),
    c1_spending_pattern:     r(0.50, 0.85),
    c2_impulse_purchase:     r(0.55, 0.90),
    c3_grocery_purchase:     r(0.45, 0.85),
    c4_balance_maintenance:  r(0.50, 0.85),
    d1_exercise:             r(0.35, 0.80),
    d2_eco_transport:        r(0.35, 0.80),
    d3_energy_saving:        r(0.30, 0.75),
    d4_volunteer:            r(0.20, 0.70),
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
     * FastAPI /calculate 호출 → 점수 산출 + Supabase 저장
     * features를 넘기지 않으면 Mock 피처 사용 (데모 모드)
     */
    calculateScore: async (userId, features) => {
      if (get().isCalculating) return;
      set(state => { state.isCalculating = true; state.error = null; });

      try {
        const featInput = features ?? generateMockFeatures();
        const response = await api.post<GodScoreCalculateResponse>(
          '/api/v1/godscore/calculate',
          {
            features: featInput,
            quarterly_base_score: get().quarterlyBaseScore,
          },
        );

        // 서버 가중치로 로컬 상태 업데이트
        const newWeights: CategoryWeights = {
          wA: response.weights.wA,
          wB: response.weights.wB,
          wC: response.weights.wC,
          wD: response.weights.wD,
        };

        const snapshot = buildSnapshot(
          userId,
          response,
          newWeights,
          get().featureWeights,
        );

        set(state => {
          state.currentSnapshot = snapshot;
          state.categoryWeights = newWeights;

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
     * 서버 저장 최신 점수 로드
     * 앱 재시작 시 로컬 상태 복원에 사용
     */
    loadLatestScore: async (userId) => {
      set(state => { state.isCalculating = true; state.error = null; });
      try {
        const response = await api.get<GodScoreLatestResponse>(
          '/api/v1/godscore/latest',
        );

        const snapshot = buildSnapshot(
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
     * 분기 정산: 현재 점수를 quarterlyBaseScore로 확정.
     * 실서비스: Celery Beat 분기 1회 호출 → 서버 godscores 테이블 업데이트 후 프론트 반영.
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
     * 서버 없이도 UI 렌더링 확인 가능하도록 로컬 상태만 구성
     */
    seedMockData: (userId) => {
      const catW  = get().categoryWeights;
      const featW = get().featureWeights;
      const history: GodScoreSnapshot[] = [];

      for (let i = 6; i >= 0; i--) {
        const date       = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
        const totalScore = Math.round(400 + i * 30 + Math.random() * 40);
        const tier       = getTierByScore(totalScore);
        const snapshot: GodScoreSnapshot = {
          id:                  `${userId}_${date}`,
          userId,
          date,
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
          tier,
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
export const selectIsCalculating    = (s: GodScoreState) =>
  s.isCalculating;
export const selectError            = (s: GodScoreState) =>
  s.error;
