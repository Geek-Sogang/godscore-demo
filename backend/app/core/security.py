"""
app/core/security.py
Supabase JWT 토큰 검증 및 현재 사용자 추출.

[Supabase Hosted 방식]
  - JWT_SECRET 직접 decode 방식 제거
  - supabase.auth.get_user(token) 사용 → Supabase가 서명 검증 전담
  - 이유: Hosted Supabase는 JWT_SECRET을 외부에 제공하지 않으며,
          직접 decode 시 알고리즘·시크릿 불일치로 검증 실패 가능
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.supabase_client import get_supabase

bearer_scheme = HTTPBearer()


def verify_supabase_token(token: str) -> dict:
    """
    Supabase auth.get_user()로 토큰 검증.
    성공 시 사용자 정보 dict 반환, 실패 시 401 raise.
    """
    try:
        client = get_supabase()
        # Supabase가 서명·만료·형식을 모두 검증해줌
        response = client.auth.get_user(token)
        if response is None or response.user is None:
            raise ValueError("사용자 정보 없음")
        user = response.user
        # python-jose payload와 호환되는 형태로 반환
        return {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 토큰: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """Authorization 헤더에서 토큰 추출 및 Supabase 검증"""
    return verify_supabase_token(credentials.credentials)


def get_user_id(current_user: dict = Depends(get_current_user)) -> str:
    """현재 인증된 사용자 UUID 반환"""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰에서 사용자 ID를 확인할 수 없습니다.",
        )
    return user_id
