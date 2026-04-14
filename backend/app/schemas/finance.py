"""
app/schemas/finance.py
금융 혜택 관련 응답 스키마.

금리 계산 로직은 클라이언트(FinanceReportScreen.tsx)에 있어서는 안 됩니다.
  이유: 정책 변경 시 앱 업데이트 강제, 사용자 임의 조작 가능
  해결: 모든 금리 수치는 이 엔드포인트에서 계산 후 내려줍니다.
"""
from __future__ import annotations
from pydantic import BaseModel, Field


class RateBenefitResponse(BaseModel):
    """
    갓생스코어 기반 금리 우대 혜택 응답.
    클라이언트는 이 값을 그대로 표시만 하면 됩니다.
    """
    god_score:        float = Field(description="현재 갓생스코어 (0~1000)")
    base_rate:        float = Field(description="기준 금리 (%p) — 현재 5.8%")
    discount:         float = Field(description="금리 인하폭 (%p) — 최대 1.5%p")
    final_rate:       float = Field(description="최종 적용 금리 (%p)")
    tier_label:       str   = Field(description="금리 등급 ('기본' | '일반' | '우수' | '최우수')")
    max_discount:     float = Field(description="최대 금리 인하폭 (%p)")
    score_date:       str   = Field(description="기준 점수 날짜 (YYYY-MM-DD)")
    has_score:        bool  = Field(description="갓생스코어 보유 여부 (False면 혜택 미적용)")
