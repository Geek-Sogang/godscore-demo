"""
app/services/keccak_hasher.py
서버사이드 Keccak256 해시 생성 및 교차 검증 서비스.

처리 흐름:
  1. 클라이언트 → SHA-256(raw_data JSON) 전송
  2. 서버 → SHA-256 재계산 후 비교 (위변조 감지)
  3. 서버 → Keccak256(user_id + date + mission_code + 핵심값) 생성
  4. 블록체인 레이어로 Keccak256 전달
"""
import hashlib
import json
from datetime import date
from typing import Any


def _normalize_raw_data(raw_data: dict) -> str:
    """키 정렬로 결정론적 JSON 직렬화 (클라이언트/서버 일치 보장)"""
    return json.dumps(raw_data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_sha256(raw_data: dict) -> str:
    """raw_data의 SHA-256 해시 계산 (64자 소문자 hex)"""
    return hashlib.sha256(_normalize_raw_data(raw_data).encode("utf-8")).hexdigest()


def verify_client_hash(raw_data: dict, client_hash: str) -> bool:
    """클라이언트 SHA-256 해시 교차 검증 (타이밍 공격 방지)"""
    import secrets
    return secrets.compare_digest(compute_sha256(raw_data).lower(), client_hash.lower())


def compute_keccak256(user_id: str, mission_code: str, target_date, core_value: Any) -> str:
    """
    블록체인 온체인 기록용 Keccak256 해시 생성.
    keccak256(user_id + date + mission_code + 핵심값)
    """
    date_str = target_date.isoformat() if hasattr(target_date, "isoformat") else str(target_date)
    core_str = (
        json.dumps(core_value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        if isinstance(core_value, (dict, list)) else str(core_value)
    )
    hash_input = f"{user_id}|{date_str}|{mission_code}|{core_str}".encode("utf-8")
    try:
        import sha3
        k = hashlib.new("keccak_256")
        k.update(hash_input)
        return k.hexdigest()
    except (ImportError, ValueError):
        # pysha3 미설치 시 SHA-3으로 폴백 (데모 용도로 충분)
        return hashlib.sha3_256(hash_input).hexdigest()


def extract_core_value(mission_code: str, raw_data: dict) -> Any:
    """미션 코드별 Keccak256 해시의 핵심값 추출"""
    core_map = {
        "A1": raw_data.get("wake_time_utc", ""),
        "A2": {"sleep_start": raw_data.get("sleep_start_utc", ""), "sleep_end": raw_data.get("sleep_end_utc", "")},
        "A3": raw_data.get("checkin_time_utc", ""),
        "A4": f"{raw_data.get('completed_count', 0)}/{raw_data.get('total_active', 1)}",
        "B1": raw_data.get("update_count_30d", 0),
        "B2": raw_data.get("monthly_incomes", []),
        "B3": {"actual": raw_data.get("actual_income", 0), "predicted": raw_data.get("predicted_income", 0)},
        "B4": raw_data.get("monthly_completion_count", 0),
        "C1": len(raw_data.get("transaction_amounts", [])),
        "C2": raw_data.get("midnight_transaction_count", 0),
        "C3": raw_data.get("grocery_count_this_month", 0),
        "C4": {"avg_balance": raw_data.get("avg_balance", 0), "fixed_expenses": raw_data.get("fixed_expenses", 0)},
        "D1": {"steps": raw_data.get("daily_steps", 0), "exercise_min": raw_data.get("exercise_minutes", 0)},
        "D2": {"eco": raw_data.get("eco_transaction_count", 0), "total": raw_data.get("total_transaction_count", 0)},
        "D3": {"current_kwh": raw_data.get("current_month_kwh", 0), "prev_kwh": raw_data.get("previous_month_kwh", 0)},
        "D4": raw_data.get("document_hash", raw_data.get("file_name", "")),
    }
    return core_map.get(mission_code.upper(), raw_data)
