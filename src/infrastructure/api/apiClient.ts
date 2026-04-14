/**
 * src/infrastructure/api/apiClient.ts
 * FastAPI 백엔드 공통 HTTP 클라이언트
 *
 * [수정] 에러 핸들링 강화
 *   - 5xx / 네트워크 오류 시 지수 백오프 자동 재시도 (최대 3회)
 *   - 4xx (클라이언트 오류) 는 즉시 실패 (재시도 무의미)
 *   - 재시도 간격: 300ms → 600ms → 1200ms
 *
 * 재시도 전략 근거:
 *   금융 앱에서 네트워크 순간 오류로 인한 점수 로드 실패는
 *   사용자 신뢰를 크게 떨어뜨립니다.
 *   3회 재시도 후에도 실패하면 에러를 던지고 Store에서 캐시 폴백 처리합니다.
 */
import { Platform } from 'react-native';

// ── API Base URL ─────────────────────────────────────
const DEV_API_URL = Platform.OS === 'web'
  ? 'http://localhost:8000'
  : 'http://10.0.2.2:8000';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEV_API_URL;

// ── 재시도 설정 ───────────────────────────────────────
const MAX_RETRIES      = 3;
const BASE_DELAY_MS    = 300;   // 300ms → 600ms → 1200ms (지수 백오프)
const RETRY_STATUS     = new Set([408, 429, 500, 502, 503, 504]);

// ── 에러 타입 ─────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

// ── 토큰 Provider ─────────────────────────────────────
let _getToken: (() => string | null) | null = null;

export function setTokenProvider(provider: () => string | null) {
  _getToken = provider;
}

// ── 지수 백오프 지연 ──────────────────────────────────
function delay(attempt: number): Promise<void> {
  return new Promise(resolve =>
    setTimeout(resolve, BASE_DELAY_MS * Math.pow(2, attempt - 1)),
  );
}

// ── 공통 fetch (재시도 포함) ──────────────────────────
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = _getToken?.();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : null,
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const json = await response.json();
          detail = json.detail ?? detail;
        } catch { /* json 파싱 실패 무시 */ }

        const apiError = new ApiError(response.status, detail);

        // 4xx 오류는 재시도해도 동일 → 즉시 실패
        if (!RETRY_STATUS.has(response.status)) {
          throw apiError;
        }

        lastError = apiError;
      } else {
        // 성공
        return response.json() as Promise<T>;
      }
    } catch (err) {
      if (err instanceof ApiError && !RETRY_STATUS.has(err.status)) {
        throw err;  // 4xx — 재시도 없이 즉시 throw
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // 마지막 시도가 아니면 대기 후 재시도
    if (attempt < MAX_RETRIES) {
      await delay(attempt);
    }
  }

  // 3회 모두 실패
  throw lastError ?? new Error('Unknown network error');
}

// ── 편의 메서드 ───────────────────────────────────────
export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown)   => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown)   => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};
