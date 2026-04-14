"""
app/core/security.py
Supabase JWT 토큰 검증 및 현재 사용자 추출.
FastAPI 라우터에서 Depends(get_current_user) 형태로 사용.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.core.config import get_settings

bearer_scheme = HTTPBearer()


def verify_jwt_token(token: str) -> dict:
    """Supabase JWT 검증 후 payload 반환"""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 토큰: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """Authorization 헤더에서 토큰 추출 및 검증"""
    return verify_jwt_token(credentials.credentials)


def get_user_id(current_user: dict = Depends(get_current_user)) -> str:
    """현재 인증된 사용자 UUID 반환"""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰에서 사용자 ID를 확인할 수 없습니다.",
        )
    return user_id
