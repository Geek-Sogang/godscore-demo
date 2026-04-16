/**
 * src/infrastructure/api/apiClient.ts
 * FastAPI 백엔드 공통 HTTP 클라이언트 — Axios 기반 (4단계 최종)
 *
 * [추가] setUnauthorizedHandler — 401 응답 시 authStore.signOut() 트리거
 *   순환 의존 방지: apiClient은 authStore를 import하지 않음
 *   authStore.initialize()에서 콜백을 주입 → apiClient은 콜백만 실행
 *
 * [유지] Request Interceptor: Supabase 세션 access_token 자동 주입
 * [유지] Response Interceptor: 5xx Exponential Backoff 3회 재시도
 * [유지] Platform.OS 분기: Android 10.0.2.2 / iOS·Web localhost
 */
import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { Platform } from 'react-native';
import { supabase } from '../supabase/supabaseClient';

// ── Base URL ──────────────────────────────────────────────────────
const DEV_API_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://localhost:8000',
}) as string;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEV_API_URL;

// ── 재시도 설정 ───────────────────────────────────────────────────
const MAX_RETRIES   = 3;
const BASE_DELAY_MS = 300;   // 300 → 600 → 1200 ms
const RETRY_STATUS  = new Set([408, 429, 500, 502, 503, 504]);

// ── 에러 타입 ─────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

// ── 레거시 동기 토큰 Provider (authStore 주입) ────────────────────
let _getToken: (() => string | null) | null = null;
export function setTokenProvider(provider: () => string | null): void {
  _getToken = provider;
}

// ── 401 자동 로그아웃 핸들러 (authStore 주입, 순환 의존 방지) ──────
let _onUnauthorized: (() => void | Promise<void>) | null = null;
export function setUnauthorizedHandler(handler: () => void | Promise<void>): void {
  _onUnauthorized = handler;
}

// ── 지수 백오프 지연 ──────────────────────────────────────────────
function backoffDelay(attempt: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, BASE_DELAY_MS * Math.pow(2, attempt - 1)));
}

// ── Axios 인스턴스 ────────────────────────────────────────────────
const _axios: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor — Bearer 토큰 자동 삽입 ───────────────────
_axios.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    let token: string | null = null;

    // 1순위: Supabase 세션 (항상 최신 토큰)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token ?? null;
    } catch {
      // Supabase 조회 실패 시 레거시 폴백
    }

    // 2순위: authStore.setTokenProvider() 동기 폴백
    if (!token) token = _getToken?.() ?? null;

    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ── Response Interceptor — 재시도 + 401 자동 로그아웃 ────────────
_axios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };
    if (!config) return Promise.reject(error);

    const statusCode   = error.response?.status;
    const retryCount   = config._retryCount ?? 0;

    // 401 Unauthorized → 토큰 만료 → 자동 로그아웃
    if (statusCode === 401) {
      try {
        await _onUnauthorized?.();
      } catch {
        // 로그아웃 실패해도 에러 전파
      }
      return Promise.reject(new ApiError(401, '세션이 만료되었습니다. 다시 로그인해주세요.'));
    }

    // 5xx / 타임아웃 → Exponential Backoff 재시도
    const isRetryable =
      retryCount < MAX_RETRIES &&
      (!statusCode || RETRY_STATUS.has(statusCode));

    if (isRetryable) {
      config._retryCount = retryCount + 1;
      await backoffDelay(config._retryCount);
      return _axios(config);
    }

    // 최종 실패
    if (error.response) {
      const data   = error.response.data as Record<string, unknown> | undefined;
      const detail = (data?.['detail'] as string) ?? `HTTP ${statusCode}`;
      return Promise.reject(new ApiError(error.response.status, detail));
    }

    return Promise.reject(error);
  },
);

// ── 편의 메서드 ───────────────────────────────────────────────────
export const api = {
  get:    <T>(path: string)                => _axios.get<T>(path).then(r => r.data),
  post:   <T>(path: string, body: unknown) => _axios.post<T>(path, body).then(r => r.data),
  put:    <T>(path: string, body: unknown) => _axios.put<T>(path, body).then(r => r.data),
  patch:  <T>(path: string, body: unknown) => _axios.patch<T>(path, body).then(r => r.data),
  delete: <T>(path: string)                => _axios.delete<T>(path).then(r => r.data),
};
