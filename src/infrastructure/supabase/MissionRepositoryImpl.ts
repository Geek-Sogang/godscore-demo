/**
 * src/infrastructure/supabase/MissionRepositoryImpl.ts
 * IMissionRepository의 Supabase/Mock 구현체
 *
 * missionStore는 IMissionRepository 인터페이스만 알고,
 * 이 파일의 존재를 모름 → DIP 완성
 */
import type {
  IMissionRepository,
  CompleteMissionParams,
  CompleteMissionResult,
} from '../../domain/repositories/IMissionRepository';
import type { MissionLog, UserStreak } from '../../../types/mission';
import {
  runMissionPipeline,
  getMissionLogsByUser,
  getPointBalance,
  getUserStreak,
} from './missionPipeline';

export class MissionRepositoryImpl implements IMissionRepository {
  async completeMission(params: CompleteMissionParams): Promise<CompleteMissionResult> {
    return runMissionPipeline(params);
  }

  getMissionLogs(userId: string): MissionLog[] {
    return getMissionLogsByUser(userId);
  }

  getPointBalance(userId: string): number {
    return getPointBalance(userId);
  }

  getUserStreak(userId: string): UserStreak | undefined {
    return getUserStreak(userId);
  }
}

/** 싱글턴 인스턴스 — DI 컨테이너 없이 단순 주입용 */
export const missionRepository: IMissionRepository = new MissionRepositoryImpl();
