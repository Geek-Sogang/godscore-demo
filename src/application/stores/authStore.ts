/**
 * src/application/stores/authStore.ts
 * Supabase Auth 기반 인증 상태 관리 — 4단계 최종 완성
 *
 * [추가] isLoggedIn, accessToken 상태 — 화면에서 인증 여부 직접 구독 가능
 * [추가] fallbackUserId — 비로그인 데모 모드 전용 식별자 (실제 로그인 시 사용 안 함)
 * [추가] setUnauthorizedHandler 연결 — 401 응답 시 자동 로그아웃 트리거
 *
 * 의존 방향: authStore → supabaseClient ← apiClient (순환 없음)
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../infrastructure/supabase/supabaseClient';
import { setTokenProvider, setUnauthorizedHandler } from '../../infrastructure/api/apiClient';

/** 로그인하지 않은 데모 사용자 폴백 ID */
export const FALLBACK_USER_ID = 'user_001';

// ── State ──────────────────────────────────────────────────────────
interface AuthState {
  session:        Session | null;
  /** Supabase user UUID — 로그인 시 실제 UUID, 비로그인 시 null */
  userId:         string | null;
  email:          string | null;
  /** JWT access_token — apiClient 인터셉터가 자동으로 사용 */
  accessToken:    string | null;
  /** true = 세션 보유 중 / false = 비로그인 */
  isLoggedIn:     boolean;
  isInitialized:  boolean; // [추가] 초기화 여부 추적
  isLoading:      boolean;
  error:          string | null;
}

// ── Actions ────────────────────────────────────────────────────────
interface AuthActions {
  /**
   * 앱 시작 시 호출 — 세션 복원 + apiClient 핸들러 등록
   * _layout.tsx 또는 App.tsx 최상단에서 1회만 호출
   */
  initialize:  () => Promise<void>;
  signIn:      (email: string, password: string) => Promise<void>;
  signUp:      (email: string, password: string) => Promise<void>;
  signOut:     () => Promise<void>;
  clearError:  () => void;
  /**
   * 실제 사용할 userId 반환 헬퍼
   * 로그인됐으면 userId, 아니면 FALLBACK_USER_ID
   */
  resolveUserId: () => string;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  immer((set, get) => ({
    session:     null,
    userId:      null,
    email:       null,
    accessToken: null,
    isLoggedIn:  false,
    isInitialized: false, // 기본값 false
    isLoading:   false,
    error:       null,

    initialize: async () => {
      // [가드] 이미 초기화되었다면 중복 실행 방지 (무한 루프 차단)
      if (get().isInitialized) return;

      // 1) apiClient 레거시 동기 토큰 폴백 등록
      setTokenProvider(() => get().session?.access_token ?? null);

      // 2) 401 발생 시 자동 로그아웃 — apiClient와 순환 없이 콜백으로 연결
      setUnauthorizedHandler(async () => {
        await get().signOut();
      });

      // 3) 기존 세션 복원
      const { data } = await supabase.auth.getSession();
      
      set(state => {
        if (data.session) {
          state.session     = data.session;
          state.userId      = data.session.user.id;
          state.email       = data.session.user.email ?? null;
          state.accessToken = data.session.access_token;
          state.isLoggedIn  = true;
        }
        state.isInitialized = true; // 초기화 완료 표시
      });

      // 4) 세션 변경 실시간 감지 (토큰 갱신 포함)
      supabase.auth.onAuthStateChange((_event, session) => {
        set(state => {
          state.session     = session;
          state.userId      = session?.user.id     ?? null;
          state.email       = session?.user.email  ?? null;
          state.accessToken = session?.access_token ?? null;
          state.isLoggedIn  = session !== null;
        });
      });
    },

    signIn: async (email, password) => {
      set(state => { state.isLoading = true; state.error = null; });
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        set(state => {
          state.session     = data.session;
          state.userId      = data.user?.id     ?? null;
          state.email       = data.user?.email  ?? null;
          state.accessToken = data.session?.access_token ?? null;
          state.isLoggedIn  = true;
        });
      } catch (e: unknown) {
        set(state => { state.error = (e as Error).message; });
        throw e;
      } finally {
        set(state => { state.isLoading = false; });
      }
    },

    signUp: async (email, password) => {
      set(state => { state.isLoading = true; state.error = null; });
      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        set(state => {
          state.session     = data.session;
          state.userId      = data.user?.id     ?? null;
          state.email       = data.user?.email  ?? null;
          state.accessToken = data.session?.access_token ?? null;
          state.isLoggedIn  = data.session !== null;
        });
      } catch (e: unknown) {
        set(state => { state.error = (e as Error).message; });
        throw e;
      } finally {
        set(state => { state.isLoading = false; });
      }
    },

    signOut: async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        set(state => {
          state.session     = null;
          state.userId      = null;
          state.email       = null;
          state.accessToken = null;
          state.isLoggedIn  = false;
        });
      }
    },

    clearError: () => set(state => { state.error = null; }),

    resolveUserId: () => get().userId ?? FALLBACK_USER_ID,
  }))
);

/** 외부 참조용 supabase 클라이언트 재export (하위 호환) */
export { supabase };
