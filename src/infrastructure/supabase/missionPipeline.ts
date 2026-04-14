/**
 * src/infrastructure/supabase/missionPipeline.ts
 * 미션 데이터 파이프라인 — FastAPI 서버 연동 버전
 *
 * 3단계 풀스택 전환:
 *   이전: 인메모리 Map 기반 Mock DB
 *   이후: FastAPI POST /api/v1/missions/complete 호출
 *         서버에서 Supabase INSERT + Keccak256 해싱 + Mock 블록체인 처리
 *
 * 서버 처리 흐름 (백엔드 routers/missions.py):
 *   Step 2. SHA-256 교차 검증 (위변조 감지)
 *   Step 3. 중복 체크 + AI 생성물 판별
 *   Step 4. 정규화 점수 산출 → mission_logs INSERT
 *   Step 5. Keccak256 → blockchain_records INSERT
 */
import { computeSHA256 } from '../blockchain/keccak256';
import { api } from '../api/apiClient';
import type { MissionLog, UserStreak } from "../../../types/mission";
import type { CompleteMissionInput } from "../../domain/usecases/CompleteMission";
import type { MissionFeatureId } from "../../../types/features";

// ── 미션 코드 매핑 ────────────────────────────────────────
// MissionFeatureId ("A_1") → mission_code ("A1") + mission_name
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

// ── 로컬 캐시 (동기 조회 인터페이스 유지용) ──────────────
// completeMission() 성공 시 갱신되며, getMissionLogs 등 동기 메서드에서 사용
const _cachedMissionLogs: Map<string, MissionLog[]> = new Map();
const _cachedPointBalance: Map<string, number>     = new Map();
const _cachedStreak: Map<string, UserStreak>        = new Map();

// ── FastAPI 응답 타입 ─────────────────────────────────────
interface CompleteMissionApiResponse {
  success: boolean;
  mission_log_id: string;
  server_hash: string;
  tx_hash: string;
  normalized_score: number;
  points_earned: number;
  ai_verified: boolean | null;
  message: string;
}

// ── 파이프라인 실행 ───────────────────────────────────────

/**
 * 전체 미션 완료 파이프라인 실행
 *
 * 클라이언트 책임:
 *   1. rawData JSON 직렬화
 *   2. SHA-256 클라이언트 해시 계산 → 서버 교차 검증용
 *
 * 서버 책임 (FastAPI):
 *   3. 중복/AI 검증, 4. 점수 산출, 5. Keccak256 + 블록체인 기록
 */
export async function runMissionPipeline(
  input: CompleteMissionInput,
): Promise<{ missionLog: MissionLog; txHash: string; verified: boolean }> {

  // 미션 메타 정보 조회
  const meta = MISSION_META[input.missionId];
  if (!meta) {
    throw new Error(`[Pipeline] 알 수 없는 미션 ID: ${input.missionId}`);
  }

  // raw_data: rawDataSerialized 역직렬화 (string → object)
  let rawData: Record<string, unknown>;
  try {
    rawData = JSON.parse(input.rawDataSerialized);
  } catch {
    // 직렬화 불가 데이터는 단순 래핑
    rawData = { raw: input.rawDataSerialized };
  }

  // 클라이언트 SHA-256 해시 생성 (위변조 감지용)
  const clientHash = computeSHA256(input.rawDataSerialized);

  // FastAPI POST /api/v1/missions/complete 호출
  const response = await api.post<CompleteMissionApiResponse>(
    '/api/v1/missions/complete',
    {
      category:     meta.category,        // "A" | "B" | "C" | "D"
      mission_code: meta.code,            // "A1" ~ "D4"
      mission_name: meta.name,            // 한국어 미션명
      raw_data:     rawData,              // 역직렬화된 원시 데이터
      client_hash:  clientHash,           // SHA-256 교차 검증용
      completed_at: new Date().toISOString(),
    },
  );

  if (!response.success) {
    throw new Error(`[Pipeline] 서버 처리 실패: ${response.message}`);
  }

  // MissionLog 객체 구성 (서버 응답 → 클라이언트 타입 변환)
  const now = new Date().toISOString();
  const missionLog: MissionLog = {
    id:                 response.mission_log_id,
    userId:             input.userId,
    missionId:          input.missionId as MissionFeatureId,
    status:             'VERIFIED',
    completedAt:        now,
    rawDataHash:        clientHash,
    utcTimestamp:       now,
    aiVerificationScore: response.ai_verified !== null
      ? (response.ai_verified ? 0.1 : 0.9)   // 검증됨=낮은 AI점수, 의심=높은 AI점수
      : null,
    aiGeneratedFlag:    response.ai_verified === false,
    pointsEarned:       response.points_earned,
    blockchainRecorded: true,
    txHash:             response.tx_hash,
    createdAt:          now,
  };

  // 로컬 캐시 갱신
  const userId = input.userId;
  const existing = _cachedMissionLogs.get(userId) ?? [];
  _cachedMissionLogs.set(userId, [...existing, missionLog]);
  _cachedPointBalance.set(
    userId,
    (_cachedPointBalance.get(userId) ?? 0) + response.points_earned,
  );

  return {
    missionLog,
    txHash:   response.tx_hash,
    verified: true,
  };
}

// ── 조회 함수 (동기 캐시 기반) ────────────────────────────

/** 사용자 미션 로그 조회 (캐시 기반) */
export function getMissionLogsByUser(userId: string): MissionLog[] {
  return _cachedMissionLogs.get(userId) ?? [];
}

/** 포인트 잔액 조회 (캐시 기반) */
export function getPointBalance(userId: string): number {
  return _cachedPointBalance.get(userId) ?? 0;
}

/** 스트릭 정보 조회 (캐시 기반) */
export function getUserStreak(userId: string): UserStreak | undefined {
  return _cachedStreak.get(userId);
}

// ── 서버 데이터 비동기 동기화 ────────────────────────────

/** 서버에서 스트릭 정보를 가져와 캐시 갱신 */
export async function syncStreakFromServer(userId: string): Promise<UserStreak | null> {
  try {
    const data = await api.get<{
      streak_count: number;
      point_balance: number;
      last_checkin_at: string | null;
      next_bonus_milestone: number | null;
      days_to_next_bonus: number | null;
    }>('/api/v1/missions/streak');

    const streak: UserStreak = {
      userId,
      currentStreak:   data.streak_count,
      longestStreak:   data.streak_count,    // 서버 별도 필드 없으면 동일
      lastCheckInDate: data.last_checkin_at
        ? data.last_checkin_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      bonusMilestones: [7, 30, 100],
      daysToNextBonus: data.days_to_next_bonus ?? 7,
    };

    _cachedStreak.set(userId, streak);
    _cachedPointBalance.set(userId, data.point_balance);
    return streak;
  } catch {
    // 서버 오류 시 캐시 유지
    return _cachedStreak.get(userId) ?? null;
  }
}

/** 서버에서 오늘 미션 로그를 가져와 캐시 갱신 */
export async function syncTodayMissionsFromServer(userId: string): Promise<void> {
  try {
    const data = await api.get<{
      date: string;
      completed_missions: Array<{
        mission_code: string;
        mission_name: string;
        category: string;
        normalized_score: number;
        on_chain: boolean;
        completed_at: string;
      }>;
      count: number;
    }>('/api/v1/missions/today');

    const logs: MissionLog[] = data.completed_missions.map(m => {
      // mission_code "A1" → MissionFeatureId "A_1" 역변환
      const missionId = `${m.mission_code[0]}_${m.mission_code[1]}` as MissionFeatureId;
      return {
        id:                  `${userId}_${m.mission_code}_${m.completed_at}`,
        userId,
        missionId,
        status:              m.on_chain ? 'VERIFIED' : 'COMPLETED',
        completedAt:         m.completed_at,
        rawDataHash:         '',
        utcTimestamp:        m.completed_at,
        aiVerificationScore: null,
        aiGeneratedFlag:     false,
        pointsEarned:        Math.round(m.normalized_score * 100),
        blockchainRecorded:  m.on_chain,
        txHash:              null,
        createdAt:           m.completed_at,
      };
    });

    _cachedMissionLogs.set(userId, logs);
  } catch {
    // 서버 오류 시 캐시 유지
  }
}

/** Mock DB 전체 초기화 (테스트용) */
export function resetMockDB(): void {
  _cachedMissionLogs.clear();
  _cachedPointBalance.clear();
  _cachedStreak.clear();
}
