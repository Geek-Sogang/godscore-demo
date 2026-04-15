"""
jobs/ml/synthetic_data.py
합성 훈련 데이터 생성기

실서비스에서는 은행 DB의 실제 mission_logs + loan_repayments 데이터를 사용.
현재는 XGBoost 모델 초기화 및 파이프라인 검증 목적으로 합성 데이터를 생성.

생성 논리:
  - 피처 점수가 전반적으로 높은 사용자 → 대출 상환 확률 높음 (레이블=1)
  - 소득 안정성(B), 잔고 유지(C4)가 특히 상환에 강한 영향
  - ESG(D)는 간접적 영향
"""

import numpy as np
import pandas as pd
from typing import Tuple


FEATURE_COLUMNS = [
    "A1_wake_score", "A2_sleep_score", "A3_checkin_score", "A4_mission_rate",
    "B1_portfolio_score", "B2_income_stability", "B3_income_predictability", "B4_work_completion",
    "C1_spending_regularity", "C2_impulse_control", "C3_grocery_score", "C4_balance_maintain",
    "D1_health_score", "D2_eco_score", "D3_energy_score", "D4_volunteer_score",
]

# 피처별 상환에 대한 영향력 (실제 재학습 시 이 가중치가 XGBoost로 자동 학습됨)
_TRUE_WEIGHTS = {
    "A1_wake_score": 0.04, "A2_sleep_score": 0.04, "A3_checkin_score": 0.03, "A4_mission_rate": 0.04,
    "B1_portfolio_score": 0.08, "B2_income_stability": 0.12, "B3_income_predictability": 0.10, "B4_work_completion": 0.07,
    "C1_spending_regularity": 0.08, "C2_impulse_control": 0.09, "C3_grocery_score": 0.04, "C4_balance_maintain": 0.10,
    "D1_health_score": 0.04, "D2_eco_score": 0.03, "D3_energy_score": 0.03, "D4_volunteer_score": 0.04,
}


def generate_training_data(
    n_samples: int = 2000,
    repayment_rate: float = 0.72,
    random_seed: int = 42,
) -> Tuple[pd.DataFrame, np.ndarray]:
    """
    합성 훈련 데이터 생성

    Parameters
    ----------
    n_samples      : 생성할 샘플 수
    repayment_rate : 상환 성공 비율 (긱 워커 실제 상환율 반영)
    random_seed    : 재현성 보장

    Returns
    -------
    X : 피처 행렬 DataFrame (n_samples × 16)
    y : 레이블 배열 (1=상환, 0=미상환)
    """
    rng = np.random.default_rng(random_seed)

    # 피처 점수: Beta 분포 (0~1 범위, 현실적인 분포)
    # α=2, β=1.5 → 오른쪽 치우침 (대부분 0.4~0.9)
    features = {
        col: rng.beta(2, 1.5, size=n_samples)
        for col in FEATURE_COLUMNS
    }
    X = pd.DataFrame(features)

    # 상환 확률: 피처 가중합 + 노이즈
    logit = sum(
        X[col] * weight
        for col, weight in _TRUE_WEIGHTS.items()
    )
    # 시그모이드 → 확률 → 이진 레이블
    prob = 1 / (1 + np.exp(-(logit * 6 - 2)))  # 스케일 조정으로 repayment_rate 근사
    y = (rng.random(n_samples) < prob).astype(int)

    # 실제 상환율에 맞게 보정
    current_rate = y.mean()
    if abs(current_rate - repayment_rate) > 0.05:
        threshold = np.percentile(prob, (1 - repayment_rate) * 100)
        y = (prob >= threshold).astype(int)

    return X, y


if __name__ == "__main__":
    X, y = generate_training_data(n_samples=500)
    print(f"생성 완료: {len(X)}건, 상환율={y.mean():.2%}")
    print(X.describe().round(3).to_string())
