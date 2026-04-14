"""
app/routers/godscore.py
갓생스코어 API 엔드포인트.
  POST /api/v1/godscore/calculate   - 피처 → 점수+SHAP 반환
  GET  /api/v1/godscore/latest      - 최신 점수 조회
  GET  /api/v1/godscore/history     - 점수 이력 조회
  GET  /api/v1/godscore/leaderboard - 전체 랭킹
  GET  /api/v1/godscore/weights     - 현재 카테고리 내 미션별 가중치 조회 [신규]
"""
import logging
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request

from app.schemas.godscore import (
    CalculateGodScoreRequest,
    GodScoreHistoryItem,
    IntraWeightsResponse,
)
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


@router.post(
    "/calculate",
    summary="갓생스코어 산출",
    description="""
피처 벡터 → XGBoost + SHAP 갓생스코어 산출 및 Supabase 저장.

카테고리 점수(fA~fD)는 **미션별 가중합**으로 산출됩니다.
- 수식: fX = Σ(w_i × score_i) / Σ(w_i)
- 가중치는 분기 1회 XGBoost feature_importances_ 기반으로 자동 재조정
- 현재 사용 중인 가중치는 응답의 `intra_weights` 필드에서 확인 가능
    """,
)
async def calculate_godscore(
    body: CalculateGodScoreRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
):
    """피처 벡터 → XGBoost+SHAP 갓생스코어 산출 및 Supabase 저장"""
    try:
        engine = _get_engine(request)

        # 누적 점수 조회 (최근 1개)
        cumulative_score = None
        try:
            result = (
                get_supabase()
                .table("godscores")
                .select("final_score")
                .eq("user_id", user_id)
                .order("score_date", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                cumulative_score = float(result.data[0]["final_score"])
        except Exception as e:
            logger.warning(f"누적 점수 조회 실패 (무시하고 진행): {e}")

        score_date = date.fromisoformat(body.score_date) if body.score_date else date.today()
        features_dict = body.features.model_dump()
        response = engine.calculate(
            features_dict,
            score_date=score_date,
            cumulative_score=cumulative_score,
        )

        # Supabase 저장
        try:
            cat = response["category_scores"]
            get_admin_supabase().table("godscores").upsert(
                {
                    "user_id":          user_id,
                    "score_date":       response["score_date"],
                    "fa_score":         cat["fA"],
                    "fb_score":         cat["fB"],
                    "fc_score":         cat["fC"],
                    "fd_score":         cat["fD"],
                    "quarterly_score":  response["quarterly_score"],
                    "cumulative_score": response["cumulative_score"],
                    "final_score":      response["final_score"],
                    "grade":            response["grade"],
                    "shap_values":      response["shap"],
                    "model_version":    response["model_version"],
                    # intra_weights를 JSON으로 함께 저장 (감사 추적)
                    "intra_weights":    response["intra_weights"],
                },
                on_conflict="user_id,score_date",
            ).execute()
        except Exception as e:
            logger.error(f"갓생스코어 DB 저장 실패: {e}")

        return response
    except Exception as e:
        logger.error(f"갓생스코어 산출 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest", summary="최신 갓생스코어 조회")
async def get_latest_godscore(user_id: str = Depends(get_user_id)):
    """저장된 가장 최신 갓생스코어 조회"""
    try:
        result = (
            get_supabase()
            .table("godscores")
            .select("*")
            .eq("user_id", user_id)
            .order("score_date", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return {
                "final_score": 0,
                "grade": "새싹",
                "grade_emoji": "🌱",
                "message": "미션을 완료해 갓생스코어를 쌓아보세요!",
            }
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/history",
    response_model=list[GodScoreHistoryItem],
    summary="점수 이력 조회",
)
async def get_godscore_history(
    days: int = Query(default=30, ge=7, le=365),
    user_id: str = Depends(get_user_id),
):
    """최근 N일 갓생스코어 이력 조회"""
    try:
        start = (date.today() - timedelta(days=days)).isoformat()
        result = (
            get_supabase()
            .table("godscores")
            .select("score_date,final_score,grade,fa_score,fb_score,fc_score,fd_score")
            .eq("user_id", user_id)
            .gte("score_date", start)
            .order("score_date", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leaderboard", summary="전체 갓생스코어 랭킹")
async def get_leaderboard(
    limit: int = Query(default=50, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    """Redis ZADD 기반 리더보드 (현재: Supabase VIEW 폴백)"""
    try:
        result = get_supabase().table("leaderboard").select("*").limit(limit).execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/weights",
    response_model=IntraWeightsResponse,
    summary="카테고리 내 미션별 가중치 조회",
    description="""
현재 XGBoost 모델이 사용 중인 **카테고리 내 미션별 가중치**를 반환합니다.

- 초기값: 행동경제학 기반 가설값 (A1=0.30, B3=0.35 등)
- 분기 1회 XGBoost feature_importances_ 기반 자동 재조정
- 각 카테고리(A/B/C/D) 내 합계 = 1.0

프론트에서 이 값을 사용해 "왜 내 fB 점수가 낮은가"를 설명할 수 있습니다.
    """,
)
async def get_intra_weights(request: Request, _: str = Depends(get_user_id)):
    """현재 엔진에서 사용 중인 카테고리 내 미션별 가중치 반환"""
    from app.services.godscore_engine import MODEL_VERSION
    engine = _get_engine(request)
    return IntraWeightsResponse(
        weights=engine.intra_weights,
        model_version=MODEL_VERSION,
        last_updated=None,   # 실서비스: 마지막 retrain 시각을 DB에서 조회
    )
