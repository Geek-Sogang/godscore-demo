"""
app/schemas/mission.py
미션 완료 요청 및 응답 Pydantic 스키마.
"""
from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal


class CompleteMissionRequest(BaseModel):
    """POST /api/v1/missions/complete 요청 바디"""
    mission_code: str = Field(..., pattern=r"^[A-D][1-4]$", description="미션 코드 (A1~D4)")
    mission_name: str
    category: Literal["fA", "fB", "fC", "fD"]
    raw_data: dict = Field(..., description="미션별 측정 원시값")
    client_hash: Optional[str] = Field(None, description="SHA-256(raw_data) - 위변조 감지용")
    completed_at: Optional[str] = Field(None, description="클라이언트 완료 시각 (ISO 8601 UTC)")


class CompleteMissionResponse(BaseModel):
    """POST /api/v1/missions/complete 응답"""
    success: bool
    mission_log_id: str
    server_hash: str
    tx_hash: str
    normalized_score: float
    points_earned: int
    ai_verified: Optional[bool] = None
    message: str
