/**
 * src/constants/mockData.ts
 * 데모/폴백 전용 공통 상수
 *
 * [4단계 변경] MOCK_USER_ID → FALLBACK_USER_ID 명칭 명확화
 *   실제 로그인 시: useAuthStore(s => s.resolveUserId()) 사용
 *   비로그인 데모 모드: FALLBACK_USER_ID 자동 폴백 (authStore.resolveUserId() 내부 처리)
 *
 * 외부에서 직접 FALLBACK_USER_ID 를 참조하지 말 것 — 항상 resolveUserId() 사용 권장
 */

/** 비로그인 데모 모드 폴백 사용자 ID */
export const FALLBACK_USER_ID = 'user_001';

/**
 * @deprecated FALLBACK_USER_ID 를 사용하세요.
 * 하위 호환을 위해 유지 (screens import 경로 유지)
 */
export const MOCK_USER_ID = FALLBACK_USER_ID;

/** 데모용 닉네임 */
export const MOCK_USER_NICKNAME = '민영';
