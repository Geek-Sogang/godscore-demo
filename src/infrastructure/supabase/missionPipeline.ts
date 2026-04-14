/**
 * src/infrastructure/supabase/missionPipeline.ts
 * 미션 파이프라인 — 완전 로컬 Mock 구현
 *
 * CLAUDE.md 원칙: "외부 API는 모두 Mock으로 처리 — 실제 키 없이 작동해야 함"
 * → FastAPI 서버 호출 없이 전체 파이프라인을 로컬에서 처리
 *
 * 처리 흐름:
 *   Step 1. rawData JSON 파싱 + 유효성 확인
 *   Step 2. computeSHA256 클라이언트 해시 생성
 *   Step 3. 미션별 정규화 점수 계산 (MOCK_SCORES)
 *   Step 4. MissionLog 객체 생성
 *   Step 5. computeKeccak256 트랜잭션 해시 생성 (블록체인 Mock)
 *   Step 6. 로컬 캐시 갱신
 */
import { computeSHA256, computeKeccak256 } from '../blockchain/keccak256';
import type { MissionLog, UserStreak } from "../../../types/mission";
import type { CompleteMissionInput } from "../../domain/usecases/CompleteMission";
import type { MissionFeatureId } from "../../../types/features";

// ── 미션 코드 매핑 ────────────────────────────────────────
const MISSION_META: Record<string, { code: string; category: 'A' | 'B' | 'C' | 'D'; name: string }> = {
  A_1: { code: 'A1', category: 'A', name: '기상 인증' },
  A_2: { code: 'A2', category: 'A', name: '수면 규칙성' },
  A_3: { code: 'A3', category: 'A', name: '앱 출석 일관성' },
  A_4: { code: 'A4', category: 'A', name: '미션 달성률' },
  B_1: { code: 'B1', category: 'B', name: '포트폴리오 업데이트' },
  B_2: { code: 'B2', category: 'B', name: '월 수입 변동성' },
  B_3: { code: 'B3', category: 'B', name: '수입 안정성 지수' },
  B_4: { code: 'B4', category: 'B', name: '업무 완료 인증' },
  C_1: { code: 'C1', category: 'C', name: '소비 패턴 규칙성' },
  C_2: { code: 'C2', category: 'C', name: '새벽 충동 결제 감지' },
  C_3: { code: 'C3', category: 'C', name: '식료품 구매 인증' },
  C_4: { code: 'C4', category: 'C', name: '잔고 유지 여부' },
  D_1: { code: 'D1', category: 'D', name: '운동·자기관리' },
  D_2: { code: 'D2', category: 'D', name: '대중교통·친환경 소비' },
  D_3: { code: 'D3', category: 'D', name: '에너지 절약 미션' },
  D_4: { code: 'D4', category: 'D', name: '봉사·기부 활동' },
};

// ── 미션별 Mock 정규화 점수 ───────────────────────────────
// 행동경제학 연구 기반 가설값 (분기별 XGBoost 재조정 예정)
const MOCK_SCORES: Record<string, number> = {
  A_1: 0.90, A_2: 0.82, A_3: 0.95, A_4: 0.78,
  B_1: 0.85, B_2: 0.75, B_3: 0.80, B_4: 0.88,
  C_1: 0.72, C_2: 0.70, C_3: 0.83, C_4: 0.76,
  D_1: 0.87, D_2: 0.79, D_3: 0.74, D_4: 0.91,
};

// ── 로컬 캐시 ─────────────────────────────────────────────
const _cachedMissionLogs: Map<string, MissionLog[]> = new Map();
const _cachedPointBalance: Map<string, number>      = new Map();
const _cachedStreak: Map<string, UserStreak>         = new Map();

// ── 파이프라인 실행 (완전 로컬 처리) ─────────────────────

/**
 * 미션 완료 파이프라인 — 서버 없이 로컬에서 전체 처리
 *
 * 실제 서버 연동 시 이 함수만 교체하면 됨 (DIP 원칙)
 */
export async function runMissionPipeline(
  input: CompleteMissionInput,
): Promise<{ missionLog: MissionLog; txHash: string; verified: boolean }> {

  // Step 1. 미션 메타 확인
  const meta = MISSION_META[input.missionId];
  if (!meta) {
    throw new Error(`[Pipeline] 알 수 없는 미션 ID: ${input.missionId}`);
  }

  // Step 2. 클라이언트 SHA-256 해시 (위변조 감지용 — 서버 연동 시 교차 검증)
  const clientHash = computeSHA256(input.rawDataSerialized);

  // Step 3. 미션별 정규화 점수 (Mock)
  const normalizedScore = MOCK_SCORES[input.missionId] ?? 0.80;

  // Step 4. 블록체인 트랜잭션 해시 생성 (keccak256 로컬 계산)
  //         실제: 스마트 컨트랙트 onchain 기록 후 tx_hash 반환
  const ts      = Date.now().toString(16);
  const logId   = `log_${meta.code}_${ts}`;
  const txHash  = computeKeccak256(`${clientHash}:${input.missionId}:${ts}`);

  // Step 5. MissionLog 구성
  const now = new Date().toISOString();
  const missionLog: MissionLog = {
    id:                  logId,
    userId:              input.userId,
    missionId:           input.missionId as MissionFeatureId,
    status:              'VERIFIED',
    completedAt:         now,
    rawDataHash:         clientHash,
    utcTimestamp:        now,
    aiVerificationScore: input.aiVerificationScore ?? null,
    aiGeneratedFlag:     input.aiGeneratedFlag ?? false,
    pointsEarned:        input.pointsEarned,
    blockchainRecorded:  true,
    txHash:              txHash,
    createdAt:           now,
  };

  // Step 6. 로컬 캐시 갱신
  const existing = _cachedMissionLogs.get(input.userId) ?? [];
  _cachedMissionLogs.set(input.userId, [...existing, missionLog]);
  _cachedPointBalance.set(
    input.userId,
    (_cachedPointBalance.get(input.userId) ?? 0) + input.pointsEarned,
  );

  console.log(
    `[Pipeline ✅] ${input.missionId} 완료`,
    `score=${normalizedScore}`,
    `txHash=${txHash.slice(0, 12)}...`,
  );

  return { missionLog, txHash, verified: true };
}

// ── 조회 함수 (동기 캐시 기반) ────────────────────────────

/** 사용자 미션 로그 조회 */
export function getMissionLogsByUser(userId: string): MissionLog[] {
  return _cachedMissionLogs.get(userId) ?? [];
}

/** 포인트 잔액 조회 */
export function getPointBalance(userId: string): number {
  return _cachedPointBalance.get(userId) ?? 0;
}

/** 스트릭 정보 조회 */
export function getUserStreak(userId: string): UserStreak | undefined {
  return _cachedStreak.get(userId);
}

// ── 서버 동기화 (서버 연동 시 구현 예정) ────────────────

/** 서버 스트릭 동기화 — 현재는 캐시 반환만 */
export async function syncStreakFromServer(userId: string): Promise<UserStreak | null> {
  return _cachedStreak.get(userId) ?? null;
}

/** 서버 오늘 미션 동기화 — 현재는 캐시 반환만 */
export async function syncTodayMissionsFromServer(_userId: string): Promise<void> {
  // 서버 연동 전: no-op
}

/** 테스트용 전체 초기화 */
export function resetMockDB(): void {
  _cachedMissionLogs.clear();
  _cachedPointBalance.clear();
  _cachedStreak.clear();
}
