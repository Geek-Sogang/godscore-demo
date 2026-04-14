/**
 * src/infrastructure/supabase/MissionRepositoryImpl.ts
 * IMissionRepository의 FastAPI + 로컬 캐시 구현체
 *
 * missionStore는 IMissionRepository 인터페이스만 알고,
 * 이 파일의 존재를 모름 → DIP 완성
 *
 * 3단계 변경:
 *   - completeMission: 인메모리 → FastAPI 서버 호출
 *   - getMissionLogs:  인메모리 → 캐시 (서버 동기화 후 반환)
 *   - getPointBalance: 인메모리 → 캐시
 *   - getUserStreak:   인메모리 → 캐시 + syncStreak() 비동기 갱신
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
  syncStreakFromServer,
  syncTodayMissionsFromServer,
} from './missionPipeline';

export class MissionRepositoryImpl implements IMissionRepository {
  /**
   * 미션 완료 처리
   * FastAPI POST /api/v1/missions/complete → Supabase INSERT + 블록체인 기록
   */
  async completeMission(params: CompleteMissionParams): Promise<CompleteMissionResult> {
    return runMissionPipeline(params);
  }

  /**
   * 미션 로그 조회 (로컬 캐시)
   * 앱 시작 시 syncTodayMissionsFromServer() 로 캐시 갱신 권장
   */
  getMissionLogs(userId: string): MissionLog[] {
    return getMissionLogsByUser(userId);
  }

  /** 포인트 잔액 (로컬 캐시) */
  getPointBalance(userId: string): number {
    return getPointBalance(userId);
  }

  /** 스트릭 정보 (로컬 캐시) */
  getUserStreak(userId: string): UserStreak | undefined {
    return getUserStreak(userId);
  }

  /**
   * 서버 데이터 동기화 (앱 시작 / 화면 포커스 시 호출)
   * GET /api/v1/missions/streak + /api/v1/missions/today
   */
  async syncFromServer(userId: string): Promise<void> {
    await Promise.allSettled([
      syncStreakFromServer(userId),
      syncTodayMissionsFromServer(userId),
    ]);
  }
}

/** 싱글턴 인스턴스 — DI 컨테이너 없이 단순 주입용 */
export const missionRepository: IMissionRepository = new MissionRepositoryImpl();
