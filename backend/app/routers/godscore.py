"""
app/routers/godscore.py
갓생스코어 API 엔드포인트.
  POST /api/v1/godscore/calculate   - 피처 → 점수+SHAP 반환
  GET  /api/v1/godscore/latest      - 최신 점수 조회
  GET  /api/v1/godscore/history     - 점수 이력 조회
  GET  /api/v1/godscore/leaderboard - 전체 랭킹
"""
import logging
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request

from app.schemas.godscore import CalculateGodScoreRequest, GodScoreHistoryItem
from app.core.security import get_current_user, get_user_id
from app.core.supabase_client import get_supabase, get_admin_supabase

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_engine(request: Request):
    """앱 상태에서 GodScoreEngine 싱글톤 반환"""
    engine = getattr(request.app.state, "godscore_engine", None)
    if engine is None:
        from app.services.godscore_engine import GodScoreEngine
        engine = GodScoreEngine()
        request.app.state.godscore_engine = engine
    return engine


@router.post("/calculate", summary="갓생스코어 산출")
async def calculate_godscore(
    body: CalculateGodScoreRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
):
    """피처 벡터 → XGBoost+SHAP 갓생스코어 산출 및 Supabase 저장"""
    try:
        engine = _get_engine(request)

        # 누적 점수 조회
        cumulative_score = None
        try:
            result = get_supabase().table("godscores").select("final_score") \
                .eq("user_id", user_id).order("score_date", desc=True).limit(1).execute()
            if result.data:
                cumulative_score = float(result.data[0]["final_score"])
        except Exception as e:
            logger.warning(f"누적 점수 조회 실패: {e}")

        score_date = date.fromisoformat(body.score_date) if body.score_date else date.today()
        features_dict = body.features.model_dump()
        response = engine.calculate(features_dict, score_date=score_date, cumulative_score=cumulative_score)

        # Supabase 저장
        try:
            cat = response["category_scores"]
            get_admin_supabase().table("godscores").upsert({
                "user_id": user_id,
                "score_date": response["score_date"],
                "fa_score": cat["fA"], "fb_score": cat["fB"],
                "fc_score": cat["fC"], "fd_score": cat["fD"],
                "quarterly_score": response["quarterly_score"],
                "cumulative_score": response["cumulative_score"],
                "final_score": response["final_score"],
                "grade": response["grade"],
                "shap_values": response["shap"],
                "model_version": response["model_version"],
            }, on_conflict="user_id,score_date").execute()
        except Exception as e:
            logger.error(f"갓생스코어 DB 저장 실패: {e}")

        return response
    except Exception as e:
        logger.error(f"갓생스코어 산출 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest", summary="최신 갓생스코어 조회")
async def get_latest_godscore(user_id: str = Depends(get_user_id)):
    try:
        result = get_supabase().table("godscores").select("*") \
            .eq("user_id", user_id).order("score_date", desc=True).limit(1).execute()
        if not result.data:
            return {"final_score": 0, "grade": "새싹", "grade_emoji": "🌱", "message": "미션을 완료해 갓생스코어를 쌓아보세요!"}
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=list[GodScoreHistoryItem], summary="점수 이력 조회")
async def get_godscore_history(
    days: int = Query(default=30, ge=7, le=365),
    user_id: str = Depends(get_user_id),
):
    try:
        start = (date.today() - timedelta(days=days)).isoformat()
        result = get_supabase().table("godscores") \
            .select("score_date,final_score,grade,fa_score,fb_score,fc_score,fd_score") \
            .eq("user_id", user_id).gte("score_date", start).order("score_date", desc=True).execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leaderboard", summary="전체 갓생스코어 랭킹")
async def get_leaderboard(
    limit: int = Query(default=50, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    try:
        result = get_supabase().table("leaderboard").select("*").limit(limit).execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
