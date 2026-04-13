/**
 * types/features.ts
 * 하나 더 — 4가지 행동 피처 타입 정의
 * 기획서 26~30p 기준 전체 세부 항목 포함
 *
 * 갓생점수 공식:
 *   fA = wA1·A1 + wA2·A2 + wA3·A3 + wA4·A4
 *   fB = wB1·B1 + wB2·B2 + wB3·B3 + wB4·B4
 *   fC = wC1·C1 + wC2·C2 + wC3·C3 + wC4·C4
 *   fD = wD1·D1 + wD2·D2 + wD3·D3 + wD4·D4
 *   S  = wA·fA  + wB·fB  + wC·fC  + wD·fD
 */

// ─────────────────────────────────────────────
// Type A: 생활 루틴 피처
// 기획서 p.26 / 키워드: #자기통제력 #지속성
// ─────────────────────────────────────────────

/** A1. 기상 인증 */
export interface FeatureA1_WakeUp {
  /** 실제 기상 시각 (ISO 8601 UTC) */
  wakeUpTime: string;
  /** 목표 기상 시각 (사용자 설정) */
  targetWakeUpTime: string;
  /** 목표 대비 오차 (분 단위, 음수 = 일찍) */
  deviationMinutes: number;
  /** 기상 인증 방식 (e.g. 'healthkit', 'manual') */
  verificationMethod: 'healthkit' | 'usage_stats' | 'manual';
  /** 인증 완료 여부 */
  verified: boolean;
  /** 원시 데이터 SHA-256 해시 (Anti-Tamper) */
  rawDataHash: string;
  /** UTC 타임스탬프 */
  timestamp: string;
}

/** A2. 수면 규칙성 */
export interface FeatureA2_SleepRegularity {
  /** 실제 취침 시각 (ISO 8601 UTC) */
  sleepTime: string;
  /** 실제 기상 시각 (ISO 8601 UTC) */
  wakeTime: string;
  /** 총 수면 시간 (분) */
  durationMinutes: number;
  /** 최근 7일 수면 시각 표준편차 (분) — 낮을수록 규칙적 */
  stdDevMinutes: number;
  /** 수면 데이터 출처 */
  source: 'apple_healthkit' | 'samsung_health' | 'manual';
  /** 수면 규칙성 점수 (0~100) */
  regularityScore: number;
  rawDataHash: string;
  timestamp: string;
}

/** A3. 앱 출석 일관성 */
export interface FeatureA3_AppAttendance {
  /** 오늘 앱 체크인 여부 */
  checkedInToday: boolean;
  /** 현재 연속 출석일 (streak) */
  currentStreakDays: number;
  /** 최장 연속 출석일 */
  longestStreakDays: number;
  /** 최근 30일 출석 비율 (0~1) */
  attendanceRate30d: number;
  /** 마지막 체크인 날짜 (YYYY-MM-DD) */
  lastCheckInDate: string;
  /** 보너스 지급 기준 달성 (7/30/100일) */
  streakBonusEligible: boolean;
  rawDataHash: string;
  timestamp: string;
}

/** A4. 미션 달성률 */
export interface FeatureA4_MissionCompletion {
  /** 오늘 전체 미션 수 */
  totalMissionsToday: number;
  /** 오늘 완료 미션 수 */
  completedMissionsToday: number;
  /** 오늘 달성률 (0~1) */
  completionRateToday: number;
  /** 최근 30일 평균 달성률 (0~1) */
  avgCompletionRate30d: number;
  /** 최근 90일 평균 달성률 (0~1) — 갓생점수 반영 기준 */
  avgCompletionRate90d: number;
  rawDataHash: string;
  timestamp: string;
}

/** Type A 생활 루틴 피처 집계 */
export interface FeatureTypeA {
  a1: FeatureA1_WakeUp;
  a2: FeatureA2_SleepRegularity;
  a3: FeatureA3_AppAttendance;
  a4: FeatureA4_MissionCompletion;
  /** fA 산출값 (0~100) */
  compositeScore: number;
}

// ─────────────────────────────────────────────
// Type B: 일·소득 관련 피처
// 기획서 p.27 / 키워드: #소득지속가능성 #미래지향성
// ─────────────────────────────────────────────

/** B1. 포트폴리오 업데이트 빈도 */
export interface FeatureB1_PortfolioUpdate {
  /** 이번 달 업데이트 횟수 */
  updateCountThisMonth: number;
  /** 최근 90일 업데이트 횟수 */
  updateCount90d: number;
  /** 마지막 업데이트 날짜 (YYYY-MM-DD) */
  lastUpdateDate: string;
  /** 업로드 파일 유형 (e.g. ['pdf', 'image', 'link']) */
  fileTypes: string[];
  /** AI 생성물 여부 판별 결과 (GPT API) */
  aiGeneratedFlag: boolean;
  /** AI 신뢰도 점수 (0~1) */
  aiConfidenceScore: number;
  rawDataHash: string;
  timestamp: string;
}

/** B2. 월 수입 변동성 */
export interface FeatureB2_IncomeVolatility {
  /** 이번 달 수입 (원) */
  currentMonthIncome: number;
  /** 최근 3개월 평균 수입 (원) */
  avg3MonthIncome: number;
  /** 최근 6개월 평균 수입 (원) */
  avg6MonthIncome: number;
  /** 월 수입 표준편차 (원) — 낮을수록 안정 */
  stdDevIncome: number;
  /** 변동계수 (CV = stdDev / mean) — 낮을수록 안정 */
  coefficientOfVariation: number;
  /** 수입 데이터 출처 */
  source: 'mydata_api' | 'manual_input' | 'bank_transaction';
  rawDataHash: string;
  timestamp: string;
}

/** B3. 수입 안정성 지수 */
export interface FeatureB3_IncomeStability {
  /** 수입이 있는 달의 비율 (최근 12개월, 0~1) */
  activeIncomeMonthRatio: number;
  /** 최소 월 수입 (원) */
  minMonthlyIncome: number;
  /** 수입 원천 다양성 (플랫폼 수) */
  incomeSourceCount: number;
  /** 고정 수입 비율 (0~1) — 정기적 수입 / 전체 */
  fixedIncomeRatio: number;
  /** 안정성 지수 (0~100, 내부 산출) */
  stabilityIndex: number;
  rawDataHash: string;
  timestamp: string;
}

/** B4. 업무 완료 인증 */
export interface FeatureB4_WorkCompletion {
  /** 이번 달 완료 업무 건수 */
  completedJobsThisMonth: number;
  /** 최근 90일 완료 업무 건수 */
  completedJobs90d: number;
  /** 플랫폼 별 완료 업무 (e.g. { upwork: 3, kmong: 2 }) */
  platformBreakdown: Record<string, number>;
  /** 업무 완료 인증 방식 */
  verificationMethod: 'platform_api' | 'file_upload' | 'manual';
  /** 플랫폼 평점 평균 (1~5) */
  averageRating: number | null;
  rawDataHash: string;
  timestamp: string;
}

/** Type B 일·소득 피처 집계 */
export interface FeatureTypeB {
  b1: FeatureB1_PortfolioUpdate;
  b2: FeatureB2_IncomeVolatility;
  b3: FeatureB3_IncomeStability;
  b4: FeatureB4_WorkCompletion;
  /** fB 산출값 (0~100) */
  compositeScore: number;
}

// ─────────────────────────────────────────────
// Type C: 소비 행동 피처
// 기획서 p.28 / 키워드: #충동성 #소비통제력
// ─────────────────────────────────────────────

/** C1. 소비 패턴 규칙성 */
export interface FeatureC1_SpendingRegularity {
  /** 이번 달 총 지출 (원) */
  totalSpendingThisMonth: number;
  /** 최근 3개월 평균 지출 (원) */
  avg3MonthSpending: number;
  /** 지출 카테고리별 비율 (e.g. { food: 0.3, transport: 0.2 }) */
  categoryRatios: Record<string, number>;
  /** 지출 규칙성 점수 (0~100) — 패턴 편차 기반 */
  regularityScore: number;
  /** 월별 지출 표준편차 (원) */
  stdDevMonthlySpending: number;
  /** 데이터 출처 */
  source: 'mydata_api' | 'bank_transaction';
  rawDataHash: string;
  timestamp: string;
}

/** C2. 새벽 충동 결제 감지 */
export interface FeatureC2_ImpulsePurchase {
  /** 이번 달 새벽(00:00~06:00) 결제 횟수 */
  midnightPurchaseCount: number;
  /** 이번 달 새벽 결제 총액 (원) */
  midnightPurchaseAmount: number;
  /** 전체 결제 대비 새벽 결제 비율 (0~1) */
  midnightPurchaseRatio: number;
  /** 충동 결제 플래그 (비율 > 임계값) */
  impulsiveFlag: boolean;
  /** 임계값 (기본값: 0.15) */
  threshold: number;
  rawDataHash: string;
  timestamp: string;
}

/** C3. 식료품 구매 인증 */
export interface FeatureC3_GroceryShopping {
  /** 이번 달 식료품 구매 횟수 */
  groceryPurchaseCount: number;
  /** 이번 달 식료품 구매 총액 (원) */
  groceryPurchaseAmount: number;
  /** 전체 식비 대비 식료품 비율 (0~1) — 외식 대비 자취 지표 */
  groceryToFoodRatio: number;
  /** 규칙적 구매 여부 (주 1회 이상) */
  regularGroceryShopper: boolean;
  /** 마트/장보기 관련 결제 가맹점명 목록 */
  groceryMerchants: string[];
  rawDataHash: string;
  timestamp: string;
}

/** C4. 잔고 유지 여부 */
export interface FeatureC4_BalanceMaintenance {
  /** 현재 주계좌 잔액 (원) */
  currentBalance: number;
  /** 최근 30일 최저 잔액 (원) */
  minBalance30d: number;
  /** 최근 30일 평균 잔액 (원) */
  avgBalance30d: number;
  /** 마이너스 잔액 발생 일수 (최근 30일) */
  negativeDays30d: number;
  /** 잔고 안정성 점수 (0~100) */
  balanceStabilityScore: number;
  /** 데이터 출처 */
  source: 'mydata_api' | 'bank_open_api';
  rawDataHash: string;
  timestamp: string;
}

/** Type C 소비 행동 피처 집계 */
export interface FeatureTypeC {
  c1: FeatureC1_SpendingRegularity;
  c2: FeatureC2_ImpulsePurchase;
  c3: FeatureC3_GroceryShopping;
  c4: FeatureC4_BalanceMaintenance;
  /** fC 산출값 (0~100) */
  compositeScore: number;
}

// ─────────────────────────────────────────────
// Type D: 개인 ESG 피처
// 기획서 p.29 / 키워드: #ESG금융통합스코어
// ─────────────────────────────────────────────

/** D1. 운동·자기관리 */
export interface FeatureD1_Exercise {
  /** 이번 주 운동 횟수 */
  exerciseCountThisWeek: number;
  /** 이번 달 운동 횟수 */
  exerciseCountThisMonth: number;
  /** 총 운동 시간 (분, 이번 달) */
  totalExerciseMinutes: number;
  /** 운동 종류 (e.g. ['walking', 'cycling', 'gym']) */
  exerciseTypes: string[];
  /** 운동 데이터 출처 */
  source: 'apple_healthkit' | 'samsung_health' | 'manual';
  /** 자기관리 미션 달성률 (0~1) */
  selfCareCompletionRate: number;
  rawDataHash: string;
  timestamp: string;
}

/** D2. 대중교통·친환경 소비 */
export interface FeatureD2_EcoFriendly {
  /** 이번 달 대중교통 이용 횟수 */
  publicTransitCount: number;
  /** 이번 달 대중교통 결제 총액 (원) */
  publicTransitAmount: number;
  /** 친환경 소비 관련 결제 횟수 (e.g. 자전거, 채식 식당 등) */
  ecoFriendlyPurchaseCount: number;
  /** 친환경 소비 총액 (원) */
  ecoFriendlyPurchaseAmount: number;
  /** 전체 교통비 중 대중교통 비율 (0~1) */
  transitRatio: number;
  /** 친환경 점수 (0~100) */
  ecoScore: number;
  rawDataHash: string;
  timestamp: string;
}

/** D3. 에너지 절약 미션 */
export interface FeatureD3_EnergySaving {
  /** 이번 달 에너지 절약 미션 완료 횟수 */
  energySavingMissionCount: number;
  /** 전월 대비 전기요금 변화율 (음수 = 절약) */
  electricityChangePct: number | null;
  /** 절약 미션 달성 여부 */
  missionAchieved: boolean;
  /** 미션 인증 방식 */
  verificationMethod: 'receipt_upload' | 'utility_api' | 'manual';
  /** 에너지 절약 점수 (0~100) */
  energyScore: number;
  rawDataHash: string;
  timestamp: string;
}

/** D4. 봉사·기부 활동 */
export interface FeatureD4_VolunteerDonation {
  /** 이번 달 봉사 횟수 */
  volunteerCountThisMonth: number;
  /** 이번 달 봉사 시간 (시간) */
  volunteerHours: number;
  /** 이번 달 기부 횟수 */
  donationCountThisMonth: number;
  /** 이번 달 기부 총액 (원) */
  donationAmount: number;
  /** 정기 기부 여부 */
  isRegularDonor: boolean;
  /** 인증 방식 */
  verificationMethod: 'certificate_upload' | 'platform_api' | 'manual';
  /** 사회 기여 점수 (0~100) */
  socialContributionScore: number;
  rawDataHash: string;
  timestamp: string;
}

/** Type D 개인 ESG 피처 집계 */
export interface FeatureTypeD {
  d1: FeatureD1_Exercise;
  d2: FeatureD2_EcoFriendly;
  d3: FeatureD3_EnergySaving;
  d4: FeatureD4_VolunteerDonation;
  /** fD 산출값 (0~100) */
  compositeScore: number;
}

// ─────────────────────────────────────────────
// 통합 행동 피처 타입
// ─────────────────────────────────────────────

/** 사용자 전체 행동 피처 스냅샷 */
export interface UserBehaviorFeatures {
  userId: string;
  /** 집계 기준일 (YYYY-MM-DD) */
  aggregationDate: string;
  typeA: FeatureTypeA;
  typeB: FeatureTypeB;
  typeC: FeatureTypeC;
  typeD: FeatureTypeD;
}

/** 피처 카테고리 식별자 */
export type FeatureCategoryId = 'A' | 'B' | 'C' | 'D';

/** 미션 ID 체계: {카테고리}_{순번} */
export type MissionFeatureId =
  | 'A_1' | 'A_2' | 'A_3' | 'A_4'
  | 'B_1' | 'B_2' | 'B_3' | 'B_4'
  | 'C_1' | 'C_2' | 'C_3' | 'C_4'
  | 'D_1' | 'D_2' | 'D_3' | 'D_4';

// ─────────────────────────────────────────────
// 미션 ID vs 피처 ID 구분
// 기획서에서 미션 수행 로그 ID와 피처 ID가 별도로 쓰일 가능성을 반영
// ─────────────────────────────────────────────

/**
 * 실제 미션 수행 로그 식별자
 * 형식: M_{카테고리}_{피처순번}_{날짜}
 * 예: M_A_1_20260413, M_B_3_20260413
 */
export type MissionId = `M_${string}`;

/**
 * 피처 ID — MissionFeatureId의 alias
 * 점수 산출·가중치 매핑에서 피처를 지칭할 때 사용
 * 예: 'A_1', 'B_2', 'C_3', 'D_4'
 */
export type FeatureId = MissionFeatureId;
