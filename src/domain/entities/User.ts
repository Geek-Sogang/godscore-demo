/**
 * src/domain/entities/User.ts
 * 사용자 엔티티 — 도메인 핵심 객체
 */

export interface UserProfile {
  id: string;
  nickname: string;
  /** 가입일 (ISO 8601) */
  joinedAt: string;
  /** 마이데이터 연동 여부 */
  myDataLinked: boolean;
  /** 하나은행 계좌 연결 여부 */
  hanaAccountLinked: boolean;
  /** CB 점수 보유 여부 (없으면 순수 대안 신용평가) */
  hasCBScore: boolean;
  /** CB 점수 (없으면 null) */
  cbScore: number | null;
}

/** 갓생 티어 정보 */
export interface GodScoreTierInfo {
  tier: string;
  label: string;
  minScore: number;
  maxScore: number;
  color: string;
}

export interface UserState {
  profile: UserProfile;
  currentTier?: GodScoreTierInfo;
  totalPoints: number;
  currentStreak: number;
}

/** 신규 사용자 기본값 생성 */
export function createDefaultUser(id: string, nickname: string): UserState {
  return {
    profile: {
      id,
      nickname,
      joinedAt: new Date().toISOString(),
      myDataLinked: false,
      hanaAccountLinked: false,
      hasCBScore: false,
      cbScore: null,
    },
    currentTier: {
      tier: 'SPROUT',
      label: '🌱 새싹',
      minScore: 0,
      maxScore: 399,
      color: '#A8D5A2',
    },
    totalPoints: 0,
    currentStreak: 0,
  };
}
