"""
app/routers/finance.py
금융 혜택 API 엔드포인트.

GET /api/v1/finance/rate-benefit
  → 갓생스코어 기반 금리 우대 혜택 계산 (서버에서만 수행)

[핵심 설계 원칙]
  금리 계산 로직은 절대 클라이언트에 두지 않습니다.
  클라이언트는 이 API를 호출해 결과를 표시만 합니다.

  이유:
    1. 정책 변경 시 앱 업데이트 없이 서버만 수정
    2. 사용자가 로컬 JS를 수정해 금리를 조작할 수 없음
    3. 감사 추적: 언제 어떤 스코어로 어떤 금리가 적용됐는지 서버 로그에 기록
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from datetime import date

from app.schemas.finance import RateBenefitResponse
from app.core.security import get_user_id
from app.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter()

# ── 금리 정책 상수 ───────────────────────────────────────
# 실서비스: 이 값을 DB 또는 환경변수에서 읽어 정책 변경 시 서버 재배포 없이 수정
BASE_RATE       = 5.8   # 기준 금리 (%p)
MAX_DISCOUNT    = 1.5   # 최대 금리 인하폭 (%p)
MIN_FINAL_RATE  = 2.5   # 최저 금리 하한 (%p)
SCORE_THRESHOLD = 90    # 혜택 적용 최소 점수 (데모: 낮게 설정)


def _calc_rate_benefit(score: float) -> dict:
    """
    갓생스코어 → 금리 우대 혜택 계산.
    금리 정책 변경 시 이 함수만 수정하면 됩니다.

    공식:
      discount = min(MAX_DISCOUNT, (score / 1000) * MAX_DISCOUNT)
      단, score < SCORE_THRESHOLD → discount = 0 (혜택 없음)
    """
    if score < SCORE_THRESHOLD:
        discount = 0.0
        tier_label = "기본"
    else:
        # 점수 비례 인하폭 (선형)
        discount = min(MAX_DISCOUNT, (score / 1000.0) * MAX_DISCOUNT)
        if score >= 850:
            tier_label = "최우수"
        elif score >= 600:
            tier_label = "우수"
        else:
            tier_label = "일반"

    final_rate = max(MIN_FINAL_RATE, BASE_RATE - discount)

    return {
        "base_rate":     round(BASE_RATE, 1),
        "discount":      round(discount, 2),
        "final_rate":    round(final_rate, 1),
        "tier_label":    tier_label,
        "max_discount":  MAX_DISCOUNT,
    }


@router.get(
    "/rate-benefit",
    response_model=RateBenefitResponse,
    summary="갓생스코어 기반 금리 우대 혜택 조회",
    description="""
사용자의 최신 갓생스코어를 기반으로 금리 우대 혜택을 계산해 반환합니다.

**금리 계산 로직은 반드시 서버에서만 수행됩니다.**

클라이언트(앱)는 이 API 응답의 수치를 그대로 표시하면 됩니다.
클라이언트 측에서 별도로 금리를 계산해서는 안 됩니다.
    """,
)
async def get_rate_benefit(user_id: str = Depends(get_user_id)):
    """갓생스코어 기반 금리 우대 혜택 계산 (서버 전담)"""
    try:
        # 최신 갓생스코어 조회
        result = (
            get_supabase()
            .table("godscores")
            .select("final_score, score_date")
            .eq("user_id", user_id)
            .order("score_date", desc=True)
            .limit(1)
            .execute()
        )

        if not result.data:
            # 갓생스코어 없는 신규 사용자
            return RateBenefitResponse(
                god_score=0.0,
                base_rate=BASE_RATE,
                discount=0.0,
                final_rate=BASE_RATE,
                tier_label="기본",
                max_discount=MAX_DISCOUNT,
                score_date=date.today().isoformat(),
                has_score=False,
            )

        row   = result.data[0]
        score = float(row["final_score"])
        benefit = _calc_rate_benefit(score)

        logger.info(
            f"금리 혜택 조회 — user={user_id[:8]}..., "
            f"score={score:.1f}, discount={benefit['discount']:.2f}%p"
        )

        return RateBenefitResponse(
            god_score=round(score, 1),
            score_date=row["score_date"],
            has_score=True,
            **benefit,
        )

    except Exception as e:
        logger.error(f"금리 혜택 조회 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
