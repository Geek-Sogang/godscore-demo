/**
 * src/infrastructure/api/apiClient.ts
 * FastAPI 백엔드 공통 HTTP 클라이언트
 *
 * - Authorization: Bearer <supabase_jwt> 헤더 자동 첨부
 * - 에러 응답을 일관된 형식으로 변환
 * - Expo Web(8081) / 앱(실기기) 모두 호환
 */
import { Platform } from 'react-native';

// ── API Base URL ─────────────────────────────────────
// 개발: 로컬 FastAPI 서버
// 실기기 테스트: PC IP 주소로 변경 (예: http://192.168.0.10:8000)
const DEV_API_URL = Platform.OS === 'web'
  ? 'http://localhost:8000'       // Expo Web
  : 'http://10.0.2.2:8000';      // Android 에뮬레이터 (iOS는 localhost)

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEV_API_URL;

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

// ── 토큰 Provider (authStore에서 주입) ───────────────
let _getToken: (() => string | null) | null = null;

export function setTokenProvider(provider: () => string | null) {
  _getToken = provider;
}

// ── 공통 fetch 래퍼 ──────────────────────────────────
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : null,
  });

  // 에러 응답 처리
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const json = await response.json();
      detail = json.detail ?? detail;
    } catch {}
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}

// ── 편의 메서드 ───────────────────────────────────────
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
