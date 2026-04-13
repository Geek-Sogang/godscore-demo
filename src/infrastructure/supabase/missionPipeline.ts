/**
 * src/infrastructure/supabase/missionPipeline.ts
 * 미션 데이터 파이프라인 Mock
 *
 * 실서비스: Supabase PostgreSQL + Kafka + 스마트 컨트랙트
 * 현단계:   인메모리 저장소로 전체 파이프라인 흐름 구현 (Step 1~5)
 *
 * 기획서 25p 파이프라인 5단계:
 *   Step1: OS/SDK 데이터 수집
 *   Step2: SHA-256 해시 + UTC 타임스탬프 첨부
 *   Step3: 서버 검증 (Anti-Tamper)
 *   Step4: 점수 산출 → PostgreSQL INSERT
 *   Step5: Blockchain 비동기 기록 (keccak256 → 스마트 컨트랙트)
 */
import { hashMissionInput, computeSHA256, generateMockTxHash, verifyIntegrity } from '../blockchain/keccak256';
import { executeCompleteMission, type CompleteMissionInput } from '../../domain/usecases/CompleteMission';
import type { MissionLog, PointLedger, UserStreak } from '../../../types/mission';
import type { BlockchainRecord, BlockchainEvent } from '../../../types/blockchain';
import type { MissionFeatureId } from '../../../types/features';

// ── 인메모리 Mock DB ──────────────────────────────────
const _missionLogs: Map<string, MissionLog> = new Map();
const _blockchainRecords: Map<string, BlockchainRecord> = new Map();
const _pointLedger: PointLedger[] = [];
const _userStreaks: Map<string, UserStreak> = new Map();
const _eventQueue: BlockchainEvent[] = [];

// ── 파이프라인 실행 ───────────────────────────────────

/**
 * 전체 미션 완료 파이프라인 실행 (Step 1~5)
 */
export async function runMissionPipeline(
  input: CompleteMissionInput,
): Promise<{ missionLog: MissionLog; txHash: string; verified: boolean }> {

  // Step 1. 원시 데이터 수집 (클라이언트에서 전달됨)
  const rawDataSerialized = input.rawDataSerialized;

  // Step 2. SHA-256 해시 + UTC 타임스탬프 첨부 (Anti-Tamper)
  const utcTimestamp = Date.now();
  const rawDataHash = computeSHA256(rawDataSerialized);

  // Step 3. 서버 검증 (중복 체크 + AI 생성물 여부)
  const duplicateKey = `${input.userId}_${input.missionId}_${new Date().toISOString().slice(0, 10)}`;
  if (_missionLogs.has(duplicateKey)) {
    throw new Error(`[Pipeline] 당일 중복 미션 요청 차단: ${duplicateKey}`);
  }
  if (input.aiGeneratedFlag === true && (input.aiVerificationScore ?? 0) > 0.8) {
    throw new Error(`[Pipeline] AI 생성물 감지: aiScore=${input.aiVerificationScore}`);
  }

  // Step 4. 점수 산출 → Mission Log INSERT
  const { missionLog, blockchainEvent, hashInput } = executeCompleteMission({
    ...input,
    rawDataSerialized,
  });

  const finalLog: MissionLog = {
    ...missionLog,
    rawDataHash,
    utcTimestamp: new Date(utcTimestamp).toISOString(),
  };

  _missionLogs.set(duplicateKey, finalLog);
  _eventQueue.push(blockchainEvent);

  // 포인트 원장 기록
  const prevBalance = _pointLedger.length > 0
    ? _pointLedger[_pointLedger.length - 1].balance
    : 0;
  _pointLedger.push({
    id: `ledger_${Date.now()}`,
    userId: input.userId,
    delta: input.pointsEarned,
    balance: prevBalance + input.pointsEarned,
    reason: `미션 완료: ${input.missionId}`,
    relatedMissionId: input.missionId,
    createdAt: new Date().toISOString(),
  });

  // 스트릭 업데이트
  _updateStreak(input.userId);

  // Step 5. Blockchain 비동기 기록 (Mock: setTimeout으로 비동기 처리)
  const txHash = await _recordToBlockchain(finalLog.id, hashInput);

  // 최종 로그 업데이트 (txHash 반영)
  finalLog.txHash = txHash;
  finalLog.blockchainRecorded = true;
  finalLog.status = 'VERIFIED';
  _missionLogs.set(duplicateKey, finalLog);

  // 무결성 검증
  const blockchainRecord = _blockchainRecords.get(finalLog.id);
  const onChainHash = blockchainRecord?.keccak256Hash ?? '';
  const verificationResult = verifyIntegrity(finalLog.id, hashInput, onChainHash);

  return {
    missionLog: finalLog,
    txHash,
    verified: verificationResult.verified,
  };
}

/**
 * Step 5: Mock 블록체인 비동기 기록
 * 실서비스: Kafka → keccak256 → 스마트 컨트랙트 호출
 */
async function _recordToBlockchain(
  missionLogId: string,
  hashInput: Parameters<typeof hashMissionInput>[0],
): Promise<string> {
  // Mock 비동기 딜레이 (실제 블록 컨펌 시뮬레이션)
  await new Promise(resolve => setTimeout(resolve, 50));

  const keccak256Hash = hashMissionInput(hashInput);
  const txHash = generateMockTxHash(missionLogId);

  const record: BlockchainRecord = {
    id: `bc_${missionLogId}`,
    missionLogId,
    userId: hashInput.userId,
    missionId: hashInput.missionId as MissionFeatureId,
    keccak256Hash,
    txHash,
    blockNumber: Math.floor(Math.random() * 1_000_000) + 18_000_000,
    contractAddress: '0xMockContractAddress_HanaMore',
    onChainConfirmed: true,
    verified: true,
    verificationError: null,
    createdAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
  };

  _blockchainRecords.set(missionLogId, record);
  return txHash;
}

/** 스트릭 업데이트 */
function _updateStreak(userId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const existing = _userStreaks.get(userId);

  if (!existing) {
    _userStreaks.set(userId, {
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastCheckInDate: today,
      bonusMilestones: [7, 30, 100],
      daysToNextBonus: 6,
    });
    return;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const isConsecutive = existing.lastCheckInDate === yesterday;
  const newStreak = isConsecutive ? existing.currentStreak + 1 : 1;
  const daysToNext = [7, 30, 100].find(m => m > newStreak) ?? 100;

  _userStreaks.set(userId, {
    ...existing,
    currentStreak: newStreak,
    longestStreak: Math.max(existing.longestStreak, newStreak),
    lastCheckInDate: today,
    daysToNextBonus: daysToNext - newStreak,
  });
}

// ── 조회 함수 ──────────────────────────────────────────

export function getMissionLogsByUser(userId: string): MissionLog[] {
  return Array.from(_missionLogs.values()).filter(log => log.userId === userId);
}

export function getBlockchainRecord(missionLogId: string): BlockchainRecord | undefined {
  return _blockchainRecords.get(missionLogId);
}

export function getUserStreak(userId: string): UserStreak | undefined {
  return _userStreaks.get(userId);
}

export function getPointBalance(userId: string): number {
  const userLedger = _pointLedger.filter(l => l.userId === userId);
  return userLedger.length > 0 ? userLedger[userLedger.length - 1].balance : 0;
}

export function getPendingBlockchainEvents(): BlockchainEvent[] {
  return _eventQueue.filter(e => e.processStatus === 'PENDING');
}

/** Mock DB 전체 초기화 (테스트용) */
export function resetMockDB(): void {
  _missionLogs.clear();
  _blockchainRecords.clear();
  _pointLedger.length = 0;
  _userStreaks.clear();
  _eventQueue.length = 0;
}
