"""
app/core/supabase_client.py
Supabase 클라이언트 싱글톤 팩토리.
- anon_client  : 일반 사용자 요청용 (RLS 적용)
- admin_client : 서버사이드 관리 작업용 (service_role 키)
"""
from functools import lru_cache
from supabase import create_client, Client
from app.core.config import get_settings


@lru_cache()
def get_supabase() -> Client:
    """익명(anon) 클라이언트 반환 - RLS 적용"""
    s = get_settings()
    return create_client(s.SUPABASE_URL, s.SUPABASE_ANON_KEY)


@lru_cache()
def get_admin_supabase() -> Client:
    """서비스 롤 클라이언트 반환 - RLS 우회 (서버 전용)"""
    s = get_settings()
    return create_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY)
