/**
 * types/featureKeys.ts
 * ──────────────────────────────────────────────────────────────────
 * 백엔드 FEATURE_COLUMNS 와 100% 일치하는 피처 키 상수.
 *
 * 이 파일이 "계약서" 역할을 합니다.
 *   - 프론트엔드: generateMockFeatures, api 요청 바디에 사용
 *   - 백엔드: godscore_engine.FEATURE_COLUMNS, GodScoreFeatures Pydantic 스키마
 *
 * 키 오타 → 컴파일 타임 에러로 즉시 감지 (Record<string, number> 대신 사용)
 * ──────────────────────────────────────────────────────────────────
 */

// ── 피처 키 목록 (백엔드 FEATURE_COLUMNS 와 동일 순서) ─────────────
export const FEATURE_KEYS = [
  // fA: 생활 루틴
  'A1_wake_score',
  'A2_sleep_score',
  'A3_checkin_score',
  'A4_mission_rate',
  // fB: 일·소득
  'B1_portfolio_score',
  'B2_income_stability',
  'B3_income_predictability',
  'B4_work_completion',
  // fC: 소비 행동
  'C1_spending_regularity',
  'C2_impulse_control',
  'C3_grocery_score',
  'C4_balance_maintain',
  // fD: 개인 ESG
  'D1_health_score',
  'D2_eco_score',
  'D3_energy_score',
  'D4_volunteer_score',
] as const;

/** 타입-안전 피처 키 (문자열 리터럴 유니온) */
export type FeatureKey = typeof FEATURE_KEYS[number];

/**
 * 타입-안전 피처 벡터.
 * Record<string, number> 대신 이 타입을 사용하면
 * "A1_wake_scroe" 같은 오타를 컴파일 타임에 잡을 수 있습니다.
 */
export type FeatureVector = Record<FeatureKey, number>;

/** 빈 피처 벡터 (기본값 0.0) */
export function makeEmptyFeatureVector(): FeatureVector {
  return Object.fromEntries(FEATURE_KEYS.map(k => [k, 0.0])) as FeatureVector;
}

/**
 * 피처 키 → 한국어 표시명 매핑
 * SHAP 설명, UI 레이블에 사용
 */
export const FEATURE_LABEL: Record<FeatureKey, string> = {
  A1_wake_score:            '기상 인증',
  A2_sleep_score:           '수면 규칙성',
  A3_checkin_score:         '앱 출석 일관성',
  A4_mission_rate:          '미션 달성률',
  B1_portfolio_score:       '포트폴리오 업데이트',
  B2_income_stability:      '수입 안정성',
  B3_income_predictability: '수입 예측 가능성',
  B4_work_completion:       '업무 완료 인증',
  C1_spending_regularity:   '소비 패턴 규칙성',
  C2_impulse_control:       '충동 결제 억제',
  C3_grocery_score:         '식료품 구매 인증',
  C4_balance_maintain:      '잔고 유지',
  D1_health_score:          '운동·자기관리',
  D2_eco_score:             '친환경 소비',
  D3_energy_score:          '에너지 절약',
  D4_volunteer_score:       '봉사·기부 활동',
} as const;
