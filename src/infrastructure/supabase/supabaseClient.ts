/**
 * src/infrastructure/supabase/supabaseClient.ts
 * Supabase 클라이언트 싱글턴 — 전 레이어가 이 파일에서 import
 *
 * [수정] 기존 authStore.ts 내부에 inline 정의되어 있던 supabase 클라이언트를 분리
 *   이전: authStore.ts 에서 createClient() → apiClient.ts 가 authStore를 import
 *         하면 순환 의존성 발생
 *   이후: 이 파일이 supabase 클라이언트의 단일 출처
 *         authStore → supabaseClient ← apiClient (순환 없음)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 환경 변수 — .env 또는 app.config.ts extra에서 주입
// 데모 모드: 빈 값이어도 클라이언트 객체 생성 자체는 가능
const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL     ?? 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'your-anon-key';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
