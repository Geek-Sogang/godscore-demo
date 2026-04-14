"""
app/main.py
하나 더 (Hana More) FastAPI 앱 진입점.

실행: cd backend && uvicorn app.main:app --reload --port 8000
Swagger: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.routers import missions, godscore, finance
from app.middleware.rate_limit import RateLimitMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 XGBoost 모델 사전 로드"""
    print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} 시작")
    print(f"   Mock 모드: 블록체인={settings.BLOCKCHAIN_MOCK_MODE}, GPT={settings.GPT_API_MOCK_MODE}")
    from app.services.godscore_engine import GodScoreEngine
    app.state.godscore_engine = GodScoreEngine(settings.MODEL_PATH)
    print("   GodScoreEngine 초기화 완료 ✅")
    yield
    print("👋 서버 종료 중...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="긱 워커 전용 생활금융 플랫폼 API - 갓생스코어 산출 및 미션 파이프라인",
    lifespan=lifespan,
)

# Rate Limiting 미들웨어 (CORS 보다 먼저 등록)
app.add_middleware(RateLimitMiddleware)

# CORS 미들웨어 (Expo Web 8081, Expo Go 19006 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins_list(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(missions.router, prefix="/api/v1/missions", tags=["미션"])
app.include_router(godscore.router, prefix="/api/v1/godscore", tags=["갓생스코어"])
app.include_router(finance.router, prefix="/api/v1/finance", tags=["금융혜택"])


@app.get("/", tags=["헬스체크"])
async def root():
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/health", tags=["헬스체크"])
async def health_check():
    """Supabase 연결 상태 포함 헬스체크"""
    from app.core.supabase_client import get_supabase
    supabase_ok = False
    try:
        get_supabase()
        supabase_ok = True
    except Exception:
        pass
    return {
        "status": "ok" if supabase_ok else "degraded",
        "supabase": "connected" if supabase_ok else "disconnected",
        "mock_mode": {"blockchain": settings.BLOCKCHAIN_MOCK_MODE, "gpt": settings.GPT_API_MOCK_MODE},
    }
