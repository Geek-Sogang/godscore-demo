"""
app/schemas/godscore.py
갓생스코어 계산 요청 및 응답 Pydantic 스키마.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


class GodScoreFeatures(BaseModel):
    """XGBoost 입력 피처 벡터 (A1~D4 서브피처, 0.0~1.0)"""
    A1_wake_score: float = Field(0.0, ge=0.0, le=1.0)
    A2_sleep_score: float = Field(0.0, ge=0.0, le=1.0)
    A3_checkin_score: float = Field(0.0, ge=0.0, le=1.0)
    A4_mission_rate: float = Field(0.0, ge=0.0, le=1.0)
    B1_portfolio_score: float = Field(0.0, ge=0.0, le=1.0)
    B2_income_stability: float = Field(0.0, ge=0.0, le=1.0)
    B3_income_predictability: float = Field(0.0, ge=0.0, le=1.0)
    B4_work_completion: float = Field(0.0, ge=0.0, le=1.0)
    C1_spending_regularity: float = Field(0.0, ge=0.0, le=1.0)
    C2_impulse_control: float = Field(0.0, ge=0.0, le=1.0)
    C3_grocery_score: float = Field(0.0, ge=0.0, le=1.0)
    C4_balance_maintain: float = Field(0.0, ge=0.0, le=1.0)
    D1_health_score: float = Field(0.0, ge=0.0, le=1.0)
    D2_eco_score: float = Field(0.0, ge=0.0, le=1.0)
    D3_energy_score: float = Field(0.0, ge=0.0, le=1.0)
    D4_volunteer_score: float = Field(0.0, ge=0.0, le=1.0)


class CalculateGodScoreRequest(BaseModel):
    features: GodScoreFeatures
    score_date: Optional[str] = Field(None, description="점수 기준 날짜 (ISO 8601)")


class GodScoreHistoryItem(BaseModel):
    score_date: str
    final_score: float
    grade: str
    fa_score: Optional[float] = None
    fb_score: Optional[float] = None
    fc_score: Optional[float] = None
    fd_score: Optional[float] = None
