/**
 * src/application/stores/missionStore.ts
 *
 * [수정 1] DIP: missionPipeline 직접 import 제거
 *          → IMissionRepository 인터페이스 통해 주입
 * [수정 2] 리렌더 배칭: loadDailyMissions + refreshPointBalance + refreshStreak
 *          → 단일 set() 블록으로 통합 (3회 → 1회 리렌더)
 * [수정 3] Race Condition 가드: processingMissionId(단일값)으로 중복 요청 차단
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { MissionLog, DailyMissionStatus, UserStreak } from '../../../types/mission';
import type { MissionFeatureId } from '../../../types/features';
import { MISSION_DEFINITIONS } from '../../domain/entities/Mission';
import type { IMissionRepository } from '../../domain/repositories/IMissionRepository';
import { missionRepository } from '../../infrastructure/supabase/MissionRepositoryImpl';

// ── State ────────────────────────────────────────────────────────────
interface MissionState {
  dailyStatus: DailyMissionStatus | null;
  completedLogs: MissionLog[];
  pointBalance: number;
  streak: UserStreak | null;
  /** [수정 3] 단일 미션 처리 중 ID (null = 처리 없음) */
  processingMissionId: MissionFeatureId | null;
  error: string | null;
}

// ── Actions ──────────────────────────────────────────────────────────
interface MissionActions {
  /**
   * [수정 2] 단일 set() 트랜잭션: 미션 목록 + 포인트 + 스트릭 일괄 갱신
   * 기존 3회 set() → 1회로 통합 → 리렌더 1회만 발생
   */
  loadDailyMissions: (userId: string) => void;
  /** 하위 호환 별칭 */
  loadAndRefreshAll: (userId: string) => void;
  completeMission: (
    userId: string,
    missionId: MissionFeatureId,
    rawData: string,
    aiScore?: number,
  ) => Promise<{ txHash: string; verified: boolean }>;
  clearError: () => void;
  /** [테스트/DI용] 레포지토리 교체 (Mock 주입 가능) */
  setRepository: (repo: IMissionRepository) => void;
}

// ── Store ─────────────────────────────────────────────────────────────
export const useMissionStore = create<MissionState & MissionActions>()(
  immer((set, get) => {
    // [수정 1] 인터페이스를 통해 주입 — 구현체(Infrastructure)에 직접 의존 안 함
    let _repo: IMissionRepository = missionRepository;

    return {
      dailyStatus:         null,
      completedLogs:       [],
      pointBalance:        0,
      streak:              null,
      processingMissionId: null,
      error:               null,

      // ── [수정 2] 단일 set() 트랜잭션 ──────────────────────────────
      loadDailyMissions: (userId) => {
        const today      = new Date().toISOString().slice(0, 10);
        const dailyDefs  = Object.values(MISSION_DEFINITIONS); // 전체 16개 미션 (daily 한정 제거)
        const completed  = get().completedLogs;
        const balance    = _repo.getPointBalance(userId);
        const streak     = _repo.getUserStreak(userId) ?? null;

        // missions: Record<MissionFeatureId, boolean> — 완료 여부 맵
        const missionsMap = Object.fromEntries(
          dailyDefs.map(def => [def.id, completed.some(l => l.missionId === def.id)])
        ) as Partial<Record<MissionFeatureId, boolean>>;
        const completedCount = Object.values(missionsMap).filter(Boolean).length;

        set(state => {
          state.pointBalance = balance;
          state.streak       = streak;
          state.dailyStatus  = {
            userId,
            date: today,
            missions: missionsMap,
            completedCount,
            totalCount: dailyDefs.length,
            completionRate: dailyDefs.length > 0 ? completedCount / dailyDefs.length : 0,
            totalPointsEarned: completed.reduce((s, l) => s + l.pointsEarned, 0),
          };
        });
      },

      // 하위 호환 별칭
      loadAndRefreshAll: (userId) => get().loadDailyMissions(userId),

      // ── [수정 3] Race Condition 가드 (단일 processingMissionId) ────
      completeMission: async (userId, missionId, rawData, aiScore) => {
        // 이미 처리 중인 미션이 있으면 즉시 차단
        if (get().processingMissionId !== null) {
          throw new Error(`[MissionStore] 이미 처리 중: ${get().processingMissionId}`);
        }

        set(state => {
          state.processingMissionId = missionId;
          state.error = null;
        });

        try {
          const missionDef = MISSION_DEFINITIONS[missionId];
          if (!missionDef) throw new Error(`미션 정의 없음: ${missionId}`);

          // [수정 1] 인터페이스 통해 호출
          const result = await _repo.completeMission({
            userId, missionId, rawDataSerialized: rawData,
            aiVerificationScore: aiScore ?? 0,
            aiGeneratedFlag: aiScore !== undefined && aiScore > 0.8,
            pointsEarned: missionDef.rewardPoints,
          });

          // [수정 2] 완료 후 모든 상태를 단일 set()으로 갱신
          const balance = _repo.getPointBalance(userId);
          const streak  = _repo.getUserStreak(userId) ?? null;
          const today   = new Date().toISOString().slice(0, 10);
          const newCompleted = [...get().completedLogs, result.missionLog];
          const dailyDefs  = Object.values(MISSION_DEFINITIONS); // 전체 16개 미션 (daily 한정 제거)
          const missionsRecord = Object.fromEntries(
            dailyDefs.map(def => [def.id, newCompleted.some(l => l.missionId === def.id)])
          ) as Partial<Record<MissionFeatureId, boolean>>;
          const completedCount = Object.values(missionsRecord).filter(Boolean).length;

          set(state => {
            state.completedLogs.push(result.missionLog);
            state.pointBalance        = balance;
            state.streak              = streak;
            state.processingMissionId = null;
            state.dailyStatus  = {
              userId, date: today, missions: missionsRecord,
              completedCount,
              totalCount: dailyDefs.length,
              completionRate: dailyDefs.length > 0 ? completedCount / dailyDefs.length : 0,
              totalPointsEarned: newCompleted.reduce((s, l) => s + l.pointsEarned, 0),
            };
          });

          return { txHash: result.txHash, verified: result.verified };
        } catch (err) {
          set(state => {
            state.error               = err instanceof Error ? err.message : '미션 처리 오류';
            state.processingMissionId = null;
          });
          throw err;
        }
      },

      clearError: () => set(state => { state.error = null; }),

      setRepository: (repo) => { _repo = repo; },
    };
  }),
);

// ── Selectors ─────────────────────────────────────────────────────────
export const selectDailyCompletionRate = (s: MissionState) =>
  s.dailyStatus?.completionRate ?? 0;

export const selectIsMissionCompleted = (missionId: MissionFeatureId) =>
  (s: MissionState) =>
    s.completedLogs.some(l => l.missionId === missionId);

/** [수정 3] 단일 processingMissionId 기반 처리 중 여부 */
export const selectIsProcessing = (missionId: MissionFeatureId) =>
  (s: MissionState) =>
    s.processingMissionId === missionId;
