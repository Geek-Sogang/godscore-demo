/**
 * src/domain/usecases/CompleteMission.ts
 * 미션 완료 유즈케이스
 *
 * 책임: 미션 완료 처리 → MissionLog 생성 → 블록체인 이벤트 페이로드 반환
 * 의존성: Domain 타입만 사용 (Infrastructure 직접 참조 금지 — DIP 원칙)
 */
import type { MissionLog, MissionStatus } from '../../../types/mission';
import type { MissionFeatureId } from '../../../types/features';
import type { BlockchainEvent, HashInput } from '../../../types/blockchain';

export interface CompleteMissionInput {
  userId: string;
  missionId: MissionFeatureId;
  /** 인증 원시 데이터 (직렬화 문자열) */
  rawDataSerialized: string;
  /** AI 검증 점수 (FILE_UPLOAD 방식일 때) */
  aiVerificationScore?: number;
  /** AI 생성물 여부 플래그 */
  aiGeneratedFlag?: boolean;
  /** 획득 포인트 */
  pointsEarned: number;
}

export interface CompleteMissionOutput {
  missionLog: MissionLog;
  blockchainEvent: BlockchainEvent;
  hashInput: HashInput;
}

/**
 * 미션 완료 유즈케이스 실행
 * 실제 해시 계산·DB 저장은 Infrastructure 레이어에서 수행
 */
export function executeCompleteMission(
  input: CompleteMissionInput,
): CompleteMissionOutput {
  const now = new Date();
  const utcTimestamp = now.toISOString();
  const logId = `log_${input.userId}_${input.missionId}_${now.getTime()}`;

  const hashInput: HashInput = {
    userId: input.userId,
    missionId: input.missionId,
    utcTimestamp: now.getTime(),
    rawDataSerialized: input.rawDataSerialized,
  };

  const missionLog: MissionLog = {
    id: logId,
    userId: input.userId,
    missionId: input.missionId,
    status: 'COMPLETED' as MissionStatus,
    completedAt: utcTimestamp,
    rawDataHash: '',         // Infrastructure에서 keccak256 계산 후 채움
    utcTimestamp,
    aiVerificationScore: input.aiVerificationScore ?? null,
    aiGeneratedFlag: input.aiGeneratedFlag ?? false,
    pointsEarned: input.pointsEarned,
    blockchainRecorded: false,
    txHash: null,
    createdAt: utcTimestamp,
  };

  const blockchainEvent: BlockchainEvent = {
    eventType: 'MISSION_COMPLETED',
    payload: hashInput,
    publishedAt: utcTimestamp,
    processStatus: 'PENDING',
  };

  return { missionLog, blockchainEvent, hashInput };
}
