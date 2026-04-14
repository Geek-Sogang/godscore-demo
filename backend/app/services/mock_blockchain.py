"""
app/services/mock_blockchain.py
블록체인 Mock 서비스.
실제 스마트 컨트랙트 없이 로컬 해시 연산으로 블록체인 흐름 시뮬레이션.
"""
import hashlib
import random
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def generate_mock_tx_hash(keccak_hash: str, user_id: str) -> str:
    """가짜 이더리움 스타일 tx_hash 생성 (mock-0x + 64자 hex)"""
    seed = f"{keccak_hash}{user_id}{datetime.now(timezone.utc).date().isoformat()}"
    return f"mock-0x{hashlib.sha256(seed.encode()).hexdigest()}"


def simulate_on_chain_record(keccak_hash: str, user_id: str, mission_log_id: str) -> dict:
    """
    블록체인 온체인 기록 시뮬레이션.
    반환값은 blockchain_records INSERT에 그대로 사용.
    """
    tx_hash = generate_mock_tx_hash(keccak_hash, user_id)
    block_number = random.randint(19_000_000, 20_000_000)
    logger.info(f"🔗 [Mock 블록체인] keccak={keccak_hash[:16]}... tx={tx_hash[:20]}...")
    return {
        "mission_log_id": mission_log_id,
        "user_id": user_id,
        "keccak_hash": keccak_hash,
        "tx_hash": tx_hash,
        "block_number": block_number,
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
        "verified": True,
    }


def compute_point_reward(mission_code: str, normalized_score: float) -> int:
    """미션 코드와 정규화 점수로 지급 포인트 계산"""
    max_points = {
        "A1": 120, "A2": 80,  "A3": 10,  "A4": 100,
        "B1": 300, "B2": 200, "B3": 250, "B4": 550,
        "C1": 150, "C2": 200, "C3": 80,  "C4": 100,
        "D1": 100, "D2": 70,  "D3": 80,  "D4": 150,
    }
    base_max = max_points.get(mission_code.upper(), 50)
    return max(10, int(base_max * normalized_score))
