"""
app/routers/missions.py
미션 완료 처리 API 엔드포인트.

미션 파이프라인 (CLAUDE.md 명세 기준):
  Step 2. SHA-256 교차 검증 (위변조 감지)
  Step 3. 중복 체크 + AI 생성물 판별
  Step 4. 정규화 점수 산출 → Supabase mission_logs INSERT
  Step 5. 포인트 지급 → 블록체인 Mock 기록
"""
import logging
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request

from app.schemas.mission import CompleteMissionRequest, CompleteMissionResponse
from app.core.security import get_user_id
from app.core.supabase_client import get_admin_supabase, get_supabase
from app.services.keccak_hasher import compute_sha256, verify_client_hash, compute_keccak256, extract_core_value
from app.services.mock_blockchain import simulate_on_chain_record, compute_point_reward
from app.services.mock_ai_validator import check_ai_generated

logger = logging.getLogger(__name__)
router = APIRouter()

FILE_UPLOAD_MISSIONS = {"B1", "B4", "D3", "D4"}


@router.post("/complete", response_model=CompleteMissionResponse, summary="미션 완료 처리")
async def complete_mission(
    body: CompleteMissionRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
):
    """미션 완료 데이터를 서버에서 검증·해싱하고 Supabase + 블록체인에 기록"""
    admin = get_admin_supabase()
    today = date.today()

    # Step 3a. 당일 중복 미션 체크
    try:
        dup = admin.table("mission_logs").select("id").eq("user_id", user_id) \
            .eq("mission_code", body.mission_code) \
            .gte("completed_at", f"{today.isoformat()}T00:00:00+00:00").execute()
        if dup.data:
            raise HTTPException(status_code=409, detail=f"오늘 '{body.mission_code}' 미션은 이미 완료하셨습니다.")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"중복 체크 오류: {e}")

    # Step 2. SHA-256 교차 검증
    tamper_detected = False
    if body.client_hash:
        if not verify_client_hash(body.raw_data, body.client_hash):
            tamper_detected = True
            logger.warning(f"⚠️ 위변조 의심: user={user_id}, mission={body.mission_code}")

    # Step 3b. AI 생성물 판별
    ai_verified, ai_check_reason = None, None
    if body.mission_code in FILE_UPLOAD_MISSIONS:
        result = check_ai_generated(body.mission_code, body.raw_data)
        ai_verified = not result["is_ai_generated"]
        ai_check_reason = result["reason"]
        if not ai_verified:
            raise HTTPException(status_code=422, detail=f"AI 생성 콘텐츠 의심: {ai_check_reason}")

    # Step 4a. 정규화 점수 산출
    engine = getattr(request.app.state, "godscore_engine", None)
    if engine is None:
        from app.services.godscore_engine import GodScoreEngine
        engine = GodScoreEngine()
        request.app.state.godscore_engine = engine

    normalized_score = engine.normalize_mission_score(body.mission_code, body.raw_data)

    # Step 4b. Keccak256 해시 생성
    keccak_hash = compute_keccak256(
        user_id, body.mission_code, today,
        extract_core_value(body.mission_code, body.raw_data)
    )

    # Step 4c. mission_logs INSERT
    completed_at = body.completed_at or datetime.now(timezone.utc).isoformat()
    try:
        log_res = admin.table("mission_logs").insert({
            "user_id": user_id,
            "category": body.category,
            "mission_code": body.mission_code,
            "mission_name": body.mission_name,
            "raw_data": body.raw_data,
            "normalized_score": normalized_score,
            "client_hash": body.client_hash,
            "server_hash": keccak_hash,
            "on_chain": False,
            "ai_verified": ai_verified,
            "ai_check_reason": ai_check_reason,
            "completed_at": completed_at,
        }).execute()
        mission_log_id = log_res.data[0]["id"]
    except Exception as e:
        logger.error(f"mission_logs INSERT 실패: {e}")
        raise HTTPException(status_code=500, detail="미션 기록 저장 중 오류가 발생했습니다.")

    # Step 5a. 포인트 지급
    points_earned = compute_point_reward(body.mission_code, normalized_score)
    try:
        user_data = admin.table("users").select("point_balance").eq("id", user_id).single().execute()
        current_balance = user_data.data.get("point_balance", 0) if user_data.data else 0
        new_balance = current_balance + points_earned
        admin.table("point_ledger").insert({
            "user_id": user_id, "event_type": "mission_complete",
            "mission_log_id": mission_log_id, "amount": points_earned,
            "balance_after": new_balance,
            "description": f"{body.mission_name} 완료 +{points_earned}pt",
        }).execute()
        admin.table("users").update({"point_balance": new_balance}).eq("id", user_id).execute()
    except Exception as e:
        logger.warning(f"포인트 처리 실패: {e}")

    # Step 5b. Mock 블록체인 기록
    tx_hash = "mock-0x" + "0" * 64
    try:
        bc = simulate_on_chain_record(keccak_hash, user_id, mission_log_id)
        tx_hash = bc["tx_hash"]
        admin.table("blockchain_records").insert(bc).execute()
        admin.table("mission_logs").update({"on_chain": True, "tx_hash": tx_hash}).eq("id", mission_log_id).execute()
    except Exception as e:
        logger.error(f"블록체인 기록 실패: {e}")

    return CompleteMissionResponse(
        success=True,
        mission_log_id=mission_log_id,
        server_hash=keccak_hash,
        tx_hash=tx_hash,
        normalized_score=normalized_score,
        points_earned=points_earned,
        ai_verified=ai_verified,
        message=(
            f"'{body.mission_name}' 완료! +{points_earned}pt 적립"
            + (" ⚠️ 위변조 의심 감지" if tamper_detected else "")
        ),
    )


@router.get("/today", summary="오늘 완료 미션 목록")
async def get_today_missions(user_id: str = Depends(get_user_id)):
    today = date.today().isoformat()
    try:
        result = get_supabase().table("mission_logs") \
            .select("mission_code,mission_name,category,normalized_score,on_chain,completed_at") \
            .eq("user_id", user_id).gte("completed_at", f"{today}T00:00:00+00:00") \
            .order("completed_at", desc=True).execute()
        return {"date": today, "completed_missions": result.data or [], "count": len(result.data or [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/streak", summary="스트릭 정보 조회")
async def get_streak_info(user_id: str = Depends(get_user_id)):
    try:
        result = get_supabase().table("users") \
            .select("streak_count,last_checkin_at,point_balance").eq("id", user_id).single().execute()
        if not result.data:
            return {"streak_count": 0, "point_balance": 0}
        streak = result.data.get("streak_count", 0)
        next_m = next((m for m in [7, 30, 100] if m > streak), None)
        return {
            "streak_count": streak,
            "point_balance": result.data.get("point_balance", 0),
            "last_checkin_at": result.data.get("last_checkin_at"),
            "next_bonus_milestone": next_m,
            "days_to_next_bonus": (next_m - streak) if next_m else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
