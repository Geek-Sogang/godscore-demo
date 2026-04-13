/**
 * src/application/stores/missionStore.ts
 * 미션 상태 관리 Zustand Store
 *
 * 관리 상태:
 *  - 오늘의 미션 목록 및 완료 상태
 *  - 포인트 잔액
 *  - 스트릭 정보
 *  - 파이프라인 처리 상태
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { MissionLog, DailyMissionStatus, UserStreak } from '../../../types/mission';
import type { MissionFeatureId } from '../../../types/features';
import { MISSION_DEFINITIONS, getDailyMissions } from '../../domain/entities/Mission';
import { runMissionPipeline, getPointBalance, getUserStreak } from '../../infrastructure/supabase/missionPipeline';

// ── State 타입 ──────────────────────────────────────────
interface MissionState {
  dailyStatus: DailyMissionStatus | null;
  /** 완료된 미션 로그 (오늘) */
  completedLogs: MissionLog[];
  /** 포인트 잔액 */
  pointBalance: number;
  /** 스트릭 정보 */
  streak: UserStreak | null;
  /** 파이프라인 처리 중인 미션 ID */
  processingMissionId: MissionFeatureId | null;
  /** 오류 */
  error: string | null;
}

// ── Actions 타입 ────────────────────────────────────────
interface MissionActions {
  /** 오늘의 일일 미션 목록 로드 */
  loadDailyMissions: (userId: string) => void;
  /**
   * 미션 완료 처리 (전체 파이프라인 실행)
   * SHA-256 → 서버 검증 → DB INSERT → Blockchain 기록
   */
  completeMission: (
    userId: string,
    missionId: MissionFeatureId,
    rawData: string,
    aiScore?: number,
  ) => Promise<{ txHash: string; verified: boolean }>;
  /** 포인트 잔액 갱신 */
  refreshPointBalance: (userId: string) => void;
  /** 스트릭 정보 갱신 */
  refreshStreak: (userId: string) => void;
  /** 에러 초기화 */
  clearError: () => void;
}

// ── Store ───────────────────────────────────────────────
export const useMissionStore = create<MissionState & MissionActions>()(
  immer((set, get) => ({
    // 초기 상태
    dailyStatus: null,
    completedLogs: [],
    pointBalance: 0,
    streak: null,
    processingMissionId: null,
    error: null,

    // ── Actions ─────────────────────────────────────────
    loadDailyMissions: (userId) => {
      const today = new Date().toISOString().slice(0, 10);
      // TODO(Supabase 연동 시): getDailyMissions() → supabase.from('missions').select()
      //   where is_daily=true AND is_active=true 로 교체
      //   현재는 MISSION_DEFINITIONS 하드코딩 테이블에서 필터링
      const dailyDefs = getDailyMissions();
      const completed = get().completedLogs;

      const missions = dailyDefs.map(def => ({
        definition: def,
        log: completed.find(l => l.missionId === def.id) ?? null,
      }));

      const completedCount = missions.filter(m => m.log !== null).length;

      set(state => {
        state.dailyStatus = {
          userId,
          date: today,
          missions,
          completedCount,
          totalCount: missions.length,
          completionRate: completedCount / missions.length,
          totalPointsEarned: completed.reduce((sum, l) => sum + l.pointsEarned, 0),
        };
      });
    },

    completeMission: async (userId, missionId, rawData, aiScore) => {
      set(state => {
        state.processingMissionId = missionId;
        state.error = null;
      });

      try {
        const missionDef = MISSION_DEFINITIONS[missionId];
        if (!missionDef) throw new Error(`미션 정의 없음: ${missionId}`);

        const result = await runMissionPipeline({
          userId,
          missionId,
          rawDataSerialized: rawData,
          aiVerificationScore: aiScore,
          aiGeneratedFlag: aiScore !== undefined && aiScore > 0.8,
          pointsEarned: missionDef.rewardPoints,
        });

        set(state => {
          state.completedLogs.push(result.missionLog);
          state.processingMissionId = null;
        });

        // 미션 목록 & 포인트 갱신
        get().loadDailyMissions(userId);
        get().refreshPointBalance(userId);
        get().refreshStreak(userId);

        return { txHash: result.txHash, verified: result.verified };
      } catch (err) {
        set(state => {
          state.error = err instanceof Error ? err.message : '미션 처리 오류';
          state.processingMissionId = null;
        });
        throw err;
      }
    },

    refreshPointBalance: (userId) => {
      const balance = getPointBalance(userId);
      set(state => { state.pointBalance = balance; });
    },

    refreshStreak: (userId) => {
      const streak = getUserStreak(userId);
      set(state => { state.streak = streak ?? null; });
    },

    clearError: () => set(state => { state.error = null; }),
  })),
);

// ── Selectors ───────────────────────────────────────────
export const selectDailyCompletionRate = (s: MissionState) =>
  s.dailyStatus?.completionRate ?? 0;

export const selectIsMissionCompleted = (missionId: MissionFeatureId) =>
  (s: MissionState) =>
    s.completedLogs.some(l => l.missionId === missionId);

export const selectIsProcessing = (missionId: MissionFeatureId) =>
  (s: MissionState) =>
    s.processingMissionId === missionId;
