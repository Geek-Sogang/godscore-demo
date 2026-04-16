/**
 * types/godScore.ts
 * 갓생점수(S) 관련 타입 정의
 * 기획서 30p 알고리즘 기반
 */


/** 갓생점수 등급 */
export type GodScoreTier = 'SPROUT' | 'DILIGENT' | 'GODLIFE' | 'LEGEND';

/** 갓생점수 등급 정보 */
export interface GodScoreTierInfo {
  tier: GodScoreTier;
  label: string;       // e.g. '🌱 새싹'
  minScore: number;
  maxScore: number;
  color: string;       // Figma 확정 후 채울 예정
}

/** 카테고리별 가중치 (wA~wD) */
export interface CategoryWeights {
  wA: number;  // 생활 루틴 (초기: 0.30)
  wB: number;  // 일·소득  (초기: 0.35)
  wC: number;  // 소비 행동 (초기: 0.25)
  wD: number;  // 개인 ESG  (초기: 0.10)
}

/** 피처별 세부 가중치 */
export interface FeatureWeights {
  // Type A
  wA1: number; wA2: number; wA3: number; wA4: number;
  // Type B
  wB1: number; wB2: number; wB3: number; wB4: number;
  // Type C
  wC1: number; wC2: number; wC3: number; wC4: number;
  // Type D
  wD1: number; wD2: number; wD3: number; wD4: number;
}

/** 피처별 점수 (fA~fD) 및 최종 갓생점수 */
export interface GodScoreBreakdown {
  fA: number;  // 생활 루틴 피처 점수 (0~100)
  fB: number;  // 일·소득 피처 점수 (0~100)
  fC: number;  // 소비 행동 피처 점수 (0~100)
  fD: number;  // ESG 피처 점수 (0~100)
  /** 최종 갓생점수 S = wA·fA + wB·fB + wC·fC + wD·fD */
  totalScore: number;
}

/** SHAP 값 — 각 피처가 점수에 기여하는 설명 가능한 값 */
export interface SHAPValue {
  featureId: string;        // e.g. 'A_1', 'B_3'
  featureName: string;      // e.g. '기상 인증'
  shapValue: number;        // 양수 = 점수 상승 기여, 음수 = 하락
  baselineScore: number;    // 전체 평균 점수
}

/** 갓생점수 스냅샷 (일별 저장 단위) */
export interface GodScoreSnapshot {
  id: string;
  userId: string;
  /** 기준일 (YYYY-MM-DD) */
  date: string;
  breakdown: GodScoreBreakdown;
  weights: CategoryWeights;
  featureWeights: FeatureWeights;
  shapValues: SHAPValue[];
  tier: GodScoreTierInfo;
  /** 분기 점수 반영 비율: 70% */
  quarterlyWeight: number;
  /** 누적 이력 반영 비율: 30% */
  accumulativeWeight: number;
  /** 최근 90일 이동평균 기반 점수 */
  movingAvg90dScore: number;
  /** 서버 산출 금리 인하 비율 (0.0~1.0) — 백엔드 estimated_rate_discount
   * loadLatestScore 시에는 score 기반 파생값, calculateScore 시에는 서버 제공값 */
  estimatedRateDiscount: number;
  createdAt: string;
}

/** 리더보드 항목 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  totalScore: number;
  tier: GodScoreTierInfo;
  /** 전일 대비 순위 변동 */
  rankChange: number;
}

/** 리더보드 타입 */
export type LeaderboardType = 'GLOBAL' | 'FRIENDS' | 'REGION';

// ─────────────────────────────────────────────
// 초기 가중치 상수
// 행동경제학 연구 기반 가설값 — 분기 1회 XGBoost 재학습으로 자동 조정
// 3단계 Mock ML Engine에서 import하여 직접 사용
// ─────────────────────────────────────────────

/**
 * 카테고리별 초기 가중치
 * wA(생활루틴) 0.30 / wB(일·소득) 0.35 / wC(소비행동) 0.25 / wD(ESG) 0.10
 * 합계 = 1.00
 */
export const INITIAL_CATEGORY_WEIGHTS: CategoryWeights = {
  wA: 0.30,
  wB: 0.35,
  wC: 0.25,
  wD: 0.10,
} as const;

/**
 * 피처별 초기 세부 가중치
 * 카테고리 내 4개 세부 피처 균등 배분 (각 0.25)
 * 분기 재학습 시 연체 이력 상관관계 기반으로 재조정
 */
export const INITIAL_FEATURE_WEIGHTS: FeatureWeights = {
  wA1: 0.25, wA2: 0.25, wA3: 0.25, wA4: 0.25,
  wB1: 0.25, wB2: 0.25, wB3: 0.25, wB4: 0.25,
  wC1: 0.25, wC2: 0.25, wC3: 0.25, wC4: 0.25,
  wD1: 0.25, wD2: 0.25, wD3: 0.25, wD4: 0.25,
} as const;

/**
 * 분기/누적 반영 비율
 * S_final = QUARTERLY_WEIGHT * S_quarterly + ACCUMULATIVE_WEIGHT * S_historical
 */
export const QUARTERLY_WEIGHT = 0.70 as const;
export const ACCUMULATIVE_WEIGHT = 0.30 as const;

/** 갓생점수 등급 테이블 (상수) */
export const GOD_SCORE_TIER_TABLE: GodScoreTierInfo[] = [
  { tier: 'SPROUT',   label: '🌱 새싹',   minScore: 0,   maxScore: 399,  color: '#A8D5A2' },
  { tier: 'DILIGENT', label: '⭐ 성실',   minScore: 400, maxScore: 599,  color: '#FFD700' },
  { tier: 'GODLIFE',  label: '🔥 갓생',   minScore: 600, maxScore: 849,  color: '#FF6B35' },
  { tier: 'LEGEND',   label: '👑 레전드', minScore: 850, maxScore: 1000, color: '#9B59B6' },
] as const;

/** 점수로 등급 조회 */
export function getTierByScore(score: number): GodScoreTierInfo {
  return (
    GOD_SCORE_TIER_TABLE.find(t => score >= t.minScore && score <= t.maxScore)
    ?? GOD_SCORE_TIER_TABLE[0]
  );
}
