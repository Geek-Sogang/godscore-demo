/**
 * src/domain/repositories/IMissionRepository.ts
 * 미션 레포지토리 인터페이스 (DIP 수정)
 *
 * Application(Store) 계층이 Infrastructure 구현체에 직접 의존하는 것을 차단.
 * missionStore는 이 인터페이스만 바라보고,
 * 실제 구현은 Infrastructure 계층(missionPipeline.ts)에서 제공.
 *
 * 마이그레이션 시:
 *   Supabase → 다른 DB: MissionPipelineImpl만 교체, Store 무관
 *   테스트:             MockMissionRepositoryImpl로 교체, Store 무관
 */
import type { MissionLog, UserStreak } from '../../../types/mission';
import type { MissionFeatureId } from '../../../types/features';

export interface CompleteMissionParams {
  userId: string;
  missionId: MissionFeatureId;
  rawDataSerialized: string;
  aiVerificationScore?: number;
  aiGeneratedFlag?: boolean;
  pointsEarned: number;
}

export interface CompleteMissionResult {
  missionLog: MissionLog;
  txHash: string;
  verified: boolean;
}

export interface IMissionRepository {
  /** 미션 완료 처리 + 블록체인 기록 (전체 파이프라인) */
  completeMission(params: CompleteMissionParams): Promise<CompleteMissionResult>;
  /** 사용자 미션 로그 조회 */
  getMissionLogs(userId: string): MissionLog[];
  /** 포인트 잔액 조회 */
  getPointBalance(userId: string): number;
  /** 스트릭 정보 조회 */
  getUserStreak(userId: string): UserStreak | undefined;
}
