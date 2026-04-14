/**
 * src/application/stores/authStore.ts
 * Supabase Auth 기반 인증 상태 관리 스토어
 *
 * - 로그인/회원가입/로그아웃
 * - JWT access_token 보관 → apiClient에 주입
 * - 앱 시작 시 자동 세션 복원
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { setTokenProvider } from '../../infrastructure/api/apiClient';

// ── Supabase 클라이언트 (프론트엔드용 anon key) ──────
// 실제 값은 .env 또는 app.config.ts의 extra에서 주입
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'your-anon-key';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── State / Actions ────────────────────────────────
interface AuthState {
  session: Session | null;
  userId: string | null;
  email: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  /** 앱 시작 시 세션 복원 + authStore → apiClient 토큰 연결 */
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  immer((set, get) => ({
    // 초기 상태
    session: null,
    userId: null,
    email: null,
    isLoading: false,
    error: null,

    initialize: async () => {
      // apiClient에 토큰 프로바이더 주입
      setTokenProvider(() => get().session?.access_token ?? null);

      // 기존 세션 복원
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        set(state => {
          state.session = data.session;
          state.userId = data.session?.user.id ?? null;
          state.email = data.session?.user.email ?? null;
        });
      }

      // 세션 변경 실시간 감지 (토큰 자동 갱신 포함)
      supabase.auth.onAuthStateChange((_event, session) => {
        set(state => {
          state.session = session;
          state.userId = session?.user.id ?? null;
          state.email = session?.user.email ?? null;
        });
      });
    },

    signIn: async (email, password) => {
      set(state => { state.isLoading = true; state.error = null; });
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        set(state => {
          state.session = data.session;
          state.userId = data.user?.id ?? null;
          state.email = data.user?.email ?? null;
        });
      } catch (e: unknown) {
        set(state => { state.error = (e as Error).message; });
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
          state.session = data.session;
          state.userId = data.user?.id ?? null;
          state.email = data.user?.email ?? null;
        });
      } catch (e: unknown) {
        set(state => { state.error = (e as Error).message; });
      } finally {
        set(state => { state.isLoading = false; });
      }
    },

    signOut: async () => {
      await supabase.auth.signOut();
      set(state => {
        state.session = null;
        state.userId = null;
        state.email = null;
      });
    },

    clearError: () => set(state => { state.error = null; }),
  }))
);
