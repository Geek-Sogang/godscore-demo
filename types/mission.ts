/**
 * types/mission.ts
 * 미션 관련 타입 정의
 * 기획서 18~22p 기반
 */

import type { MissionFeatureId, FeatureCategoryId } from './features';

/** 미션 상태 */
export type MissionStatus =
  | 'PENDING'      // 미수행
  | 'IN_PROGRESS'  // 수행 중
  | 'COMPLETED'    // 완료 (블록체인 기록 대기)
  | 'VERIFIED'     // 온체인 기록 완료
  | 'FAILED';      // 검증 실패

/** 미션 인증 방식 */
export type MissionVerificationMethod =
  | 'HEALTHKIT'         // Apple HealthKit / Samsung Health
  | 'USAGE_STATS'       // Android UsageStatsManager
  | 'FILE_UPLOAD'       // 파일/이미지 업로드 (GPT API 검증)
  | 'MYDATA_API'        // 마이데이터 표준 API
  | 'GPS'               // 위치 기반 인증
  | 'PLATFORM_API'      // 외부 플랫폼 API
  | 'RECEIPT_UPLOAD'    // 영수증 업로드
  | 'MANUAL';           // 수동 입력

/** 미션 정의 (앱 설정값) */
export interface MissionDefinition {
  /** 미션 고유 ID (e.g. 'A_1') */
  id: MissionFeatureId;
  /** 카테고리 */
  category: FeatureCategoryId;
  /** 미션명 */
  name: string;
  /** 미션 설명 */
  description: string;
  /** 인증 방식 */
  verificationMethod: MissionVerificationMethod;
  /** 획득 포인트 */
  rewardPoints: number;
  /** 피처 점수 기여도 (0~1) */
  featureContribution: number;
  /** 일일 미션 여부 */
  isDaily: boolean;
  /** 아이콘 (Figma 매칭 후 채울 예정) */
  iconName: string;
}

/** 미션 수행 로그 (mission_logs 테이블 대응) */
export interface MissionLog {
  id: string;
  userId: string;
  missionId: MissionFeatureId;
  status: MissionStatus;
  /** 완료 시각 (ISO 8601 UTC) */
  completedAt: string | null;
  /** 검증된 원시 데이터 해시 (SHA-256) */
  rawDataHash: string;
  /** UTC 타임스탬프 */
  utcTimestamp: string;
  /** AI 검증 점수 (0~1, FILE_UPLOAD 방식일 때) */
  aiVerificationScore: number | null;
  /** AI 생성물 여부 플래그 */
  aiGeneratedFlag: boolean;
  /** 획득 포인트 */
  pointsEarned: number;
  /** 블록체인 기록 여부 */
  blockchainRecorded: boolean;
  /** 블록체인 트랜잭션 해시 */
  txHash: string | null;
  createdAt: string;
}

/** 일일 미션 현황 */
export interface DailyMissionStatus {
  userId: string;
  date: string;
  missions: Array<{
    definition: MissionDefinition;
    log: MissionLog | null;
  }>;
  completedCount: number;
  totalCount: number;
  completionRate: number;
  totalPointsEarned: number;
}

/** 포인트 원장 (point_ledger 테이블 대응) */
export interface PointLedger {
  id: string;
  userId: string;
  /** 변동 포인트 (양수 = 적립, 음수 = 사용) */
  delta: number;
  /** 변동 후 잔액 */
  balance: number;
  /** 사유 */
  reason: string;
  /** 연관 미션 ID */
  relatedMissionId: MissionFeatureId | null;
  createdAt: string;
}

/** 스트릭 정보 (user_streaks 테이블 대응) */
export interface UserStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: string;
  /** 보너스 수령 기준 (7/30/100일) */
  bonusMilestones: number[];
  /** 다음 보너스까지 남은 일수 */
  daysToNextBonus: number;
}
