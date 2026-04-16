"""
app/core/config.py
환경변수를 로드하고 앱 전역 설정을 관리하는 모듈.

[Supabase Hosted 방식]
  JWT_SECRET / JWT_ALGORITHM / ACCESS_TOKEN_EXPIRE_MINUTES 제거.
  Supabase Hosted는 JWT 서명을 내부적으로 관리하므로 백엔드에서 불필요.
  토큰 검증은 supabase.auth.get_user()가 전담.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # 앱 기본 설정
    APP_NAME: str = "하나 더 (Hana More) API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Supabase 연결 정보 (Supabase 대시보드 > Settings > API)
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_ANON_KEY: str = "your-anon-key"
    SUPABASE_SERVICE_ROLE_KEY: str = "your-service-role-key"

    # CORS 허용 출처 (콤마 구분)
    CORS_ORIGINS: str = "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Mock 설정 (데모 환경에서는 모두 True)
    BLOCKCHAIN_MOCK_MODE: bool = True
    GPT_API_MOCK_MODE: bool = True
    OPENAI_API_KEY: str = "mock-key-not-required-in-demo"

    # ML 모델
    MODEL_PATH: str = "app/services/models/godscore_xgb.pkl"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    def get_cors_origins_list(self) -> list[str]:
        """CORS_ORIGINS 문자열을 리스트로 변환"""
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """설정 인스턴스를 캐싱하여 반환"""
    return Settings()
