"""
jobs/ml/retrain.py
분기별 XGBoost 가중치 재학습 배치 잡

== 실행 주체 ==
  하나은행 내부 데이터 파이프라인 (Celery Beat / cron)
  앱 서버와 완전히 분리된 환경에서 실행

== 실행 주기 ==
  분기 1회 (매 1/4/7/10월 1일 새벽 02:00 KST)

== 데이터 흐름 ==
  은행 DB (mission_logs + loan_repayments)
    → 피처 행렬 X (16컬럼) + 레이블 y (상환 여부)
    → XGBoost 재학습
    → 새 모델 pkl → app/services/models/ 업로드
    → 카테고리 가중치(wA~wD) 업데이트 → DB 저장

== 앱 서버와의 관계 ==
  앱 서버는 이 잡이 생성한 pkl을 불러와 추론(inference)만 수행
  재학습 코드는 앱 서버에 존재하지 않음 (MLOps 분리 원칙)
"""

import os
import sys
import json
import logging
import pickle
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# 경로 설정 (jobs/ 폴더에서 실행 시 backend를 sys.path에 추가)
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from synthetic_data import generate_training_data

logger = logging.getLogger(__name__)

# ── 모델 저장 경로 ────────────────────────────────────────────────────
MODEL_PATH = ROOT / "backend" / "app" / "services" / "models" / "godscore_xgb.pkl"
WEIGHTS_PATH = ROOT / "backend" / "app" / "services" / "models" / "category_weights.json"

# ── 피처 컬럼 (앱 서버와 반드시 동일해야 함) ─────────────────────────
FEATURE_COLUMNS = [
    "A1_wake_score", "A2_sleep_score", "A3_checkin_score", "A4_mission_rate",
    "B1_portfolio_score", "B2_income_stability", "B3_income_predictability", "B4_work_completion",
    "C1_spending_regularity", "C2_impulse_control", "C3_grocery_score", "C4_balance_maintain",
    "D1_health_score", "D2_eco_score", "D3_energy_score", "D4_volunteer_score",
]

# ── 카테고리 초기 가중치 (행동경제학 기반 가설값) ──────────────────────
INITIAL_WEIGHTS = {
    "wA": 0.30,   # 생활 루틴
    "wB": 0.35,   # 일·소득
    "wC": 0.25,   # 소비 행동
    "wD": 0.10,   # 개인 ESG
}

# 카테고리별 피처 매핑
CATEGORY_FEATURES = {
    "A": ["A1_wake_score", "A2_sleep_score", "A3_checkin_score", "A4_mission_rate"],
    "B": ["B1_portfolio_score", "B2_income_stability", "B3_income_predictability", "B4_work_completion"],
    "C": ["C1_spending_regularity", "C2_impulse_control", "C3_grocery_score", "C4_balance_maintain"],
    "D": ["D1_health_score", "D2_eco_score", "D3_energy_score", "D4_volunteer_score"],
}


def run_retraining(
    X: Optional[pd.DataFrame] = None,
    y: Optional[np.ndarray] = None,
    use_synthetic: bool = False,
) -> dict:
    """
    XGBoost 재학습 메인 함수

    Parameters
    ----------
    X : 피처 행렬 (None이면 은행 DB에서 로드 — 실서비스)
    y : 상환 여부 레이블 (None이면 DB에서 로드)
    use_synthetic : True면 합성 데이터 사용 (Mock/테스트용)

    Returns
    -------
    dict : 재학습 결과 메타데이터
    """
    try:
        import xgboost as xgb
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import roc_auc_score
    except ImportError:
        logger.error("xgboost / scikit-learn 미설치. pip install xgboost scikit-learn")
        raise

    # 데이터 준비
    if X is None or use_synthetic:
        logger.info("[Retrain] 합성 데이터 생성 중 (Mock 모드)...")
        X, y = generate_training_data(n_samples=2000)
    else:
        logger.info(f"[Retrain] 실제 DB 데이터 사용: {len(X)}건")

    # 피처 컬럼 순서 보장
    X = X[FEATURE_COLUMNS]

    # 훈련/검증 분리 (80/20)
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    logger.info(f"[Retrain] 훈련={len(X_train)}건, 검증={len(X_val)}건")

    # XGBoost 재학습
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric="auc",
        early_stopping_rounds=20,
        verbosity=0,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    # 검증 AUC
    val_proba = model.predict_proba(X_val)[:, 1]
    auc = roc_auc_score(y_val, val_proba)
    logger.info(f"[Retrain] 검증 AUC: {auc:.4f}")

    # 피처 중요도 → 카테고리 가중치 갱신
    new_weights = _derive_category_weights(model, X, blend_ratio=0.7)
    logger.info(f"[Retrain] 새 가중치: {new_weights}")

    # 모델 저장
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    logger.info(f"[Retrain] 모델 저장: {MODEL_PATH}")

    # 가중치 저장
    weights_payload = {
        **new_weights,
        "updated_at": datetime.utcnow().isoformat(),
        "val_auc": round(auc, 4),
        "n_train": len(X_train),
    }
    with open(WEIGHTS_PATH, "w", encoding="utf-8") as f:
        json.dump(weights_payload, f, ensure_ascii=False, indent=2)
    logger.info(f"[Retrain] 가중치 저장: {WEIGHTS_PATH}")

    return {
        "success": True,
        "val_auc": round(auc, 4),
        "weights": new_weights,
        "n_train": len(X_train),
        "model_path": str(MODEL_PATH),
        "run_at": datetime.utcnow().isoformat(),
    }


def _derive_category_weights(model, X: pd.DataFrame, blend_ratio: float = 0.7) -> dict:
    """
    피처 중요도 → 카테고리 가중치 산출

    blend_ratio = 0.7:
      새 가중치 = 기존 가중치 × 0.3 + 중요도 기반 가중치 × 0.7
    → 급격한 가중치 변화를 방지
    """
    importance = model.feature_importances_
    feat_imp = dict(zip(FEATURE_COLUMNS, importance))

    # 카테고리별 중요도 합산 → 정규화
    cat_imp = {}
    for cat, feats in CATEGORY_FEATURES.items():
        cat_imp[cat] = sum(feat_imp.get(f, 0.0) for f in feats)

    total = sum(cat_imp.values()) or 1.0
    norm_imp = {cat: v / total for cat, v in cat_imp.items()}

    # 기존 가중치와 블렌딩
    wA_prev = INITIAL_WEIGHTS["wA"]
    wB_prev = INITIAL_WEIGHTS["wB"]
    wC_prev = INITIAL_WEIGHTS["wC"]
    wD_prev = INITIAL_WEIGHTS["wD"]

    new_weights = {
        "wA": round(wA_prev * (1 - blend_ratio) + norm_imp["A"] * blend_ratio, 4),
        "wB": round(wB_prev * (1 - blend_ratio) + norm_imp["B"] * blend_ratio, 4),
        "wC": round(wC_prev * (1 - blend_ratio) + norm_imp["C"] * blend_ratio, 4),
        "wD": round(wD_prev * (1 - blend_ratio) + norm_imp["D"] * blend_ratio, 4),
    }

    # 합이 1이 되도록 재정규화
    w_total = sum(new_weights.values())
    return {k: round(v / w_total, 4) for k, v in new_weights.items()}


if __name__ == "__main__":
    """
    직접 실행 시 합성 데이터로 Mock 재학습 수행
    실서비스: Celery Beat 또는 은행 내부 스케줄러가 호출
    """
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    result = run_retraining(use_synthetic=True)
    print(json.dumps(result, ensure_ascii=False, indent=2))
