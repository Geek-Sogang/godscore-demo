"""
app/services/godscore_engine.py
XGBoost 기반 갓생스코어 산출 엔진 + SHAP 설명력 산출.

- 모델 파일 없으면 합성 데이터로 자동 초기 학습
- 분기 1회 XGBoost 재학습으로 가중치 최적화
- SHAP TreeExplainer로 피처별 기여도 산출
"""
import os
import pickle
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import date

import xgboost as xgb
import shap

logger = logging.getLogger(__name__)

FEATURE_COLUMNS = [
    "A1_wake_score", "A2_sleep_score", "A3_checkin_score", "A4_mission_rate",
    "B1_portfolio_score", "B2_income_stability", "B3_income_predictability", "B4_work_completion",
    "C1_spending_regularity", "C2_impulse_control", "C3_grocery_score", "C4_balance_maintain",
    "D1_health_score", "D2_eco_score", "D3_energy_score", "D4_volunteer_score",
]
CATEGORY_WEIGHTS = {"wA": 0.5, "wB": 0.4, "wC": 0.6, "wD": 0.3}
WEIGHT_SUM = sum(CATEGORY_WEIGHTS.values())
GRADE_THRESHOLDS = {"레전드": 850, "갓생": 650, "성실": 400, "새싹": 0}
MODEL_VERSION = "v1.0"


class GodScoreEngine:
    """XGBoost 기반 갓생스코어 산출 엔진 (싱글톤)"""

    def __init__(self, model_path: str = "app/services/models/godscore_xgb.pkl"):
        self.model_path = Path(model_path)
        self.model = None
        self.explainer = None
        self._load_or_train()

    def _load_or_train(self):
        if self.model_path.exists():
            logger.info(f"✅ XGBoost 모델 로드: {self.model_path}")
            with open(self.model_path, "rb") as f:
                saved = pickle.load(f)
                self.model = saved["model"]
                self.explainer = saved["explainer"]
        else:
            logger.info("⚙️  합성 데이터로 XGBoost 초기 학습 시작")
            self._train_with_synthetic_data()

    def _train_with_synthetic_data(self):
        """합성 데이터로 XGBoost 초기 학습 (실제 데이터 없이 데모 동작)"""
        np.random.seed(42)
        n = 5000
        X = pd.DataFrame(np.random.uniform(0, 1, (n, len(FEATURE_COLUMNS))), columns=FEATURE_COLUMNS)
        fA = X[FEATURE_COLUMNS[0:4]].mean(axis=1)
        fB = X[FEATURE_COLUMNS[4:8]].mean(axis=1)
        fC = X[FEATURE_COLUMNS[8:12]].mean(axis=1)
        fD = X[FEATURE_COLUMNS[12:16]].mean(axis=1)
        wA, wB, wC, wD = CATEGORY_WEIGHTS["wA"], CATEGORY_WEIGHTS["wB"], CATEGORY_WEIGHTS["wC"], CATEGORY_WEIGHTS["wD"]
        y = np.clip((wA*fA + wB*fB + wC*fC + wD*fD) / WEIGHT_SUM * 1000 + np.random.normal(0, 20, n), 0, 1000)

        self.model = xgb.XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.05,
                                       subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1)
        self.model.fit(X, y)
        self.explainer = shap.TreeExplainer(self.model)

        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump({"model": self.model, "explainer": self.explainer}, f)
        logger.info(f"✅ 초기 학습 완료 → {self.model_path}")

    def calculate(self, features: dict, score_date=None, cumulative_score=None) -> dict:
        """피처 딕셔너리 → 갓생스코어 + SHAP 반환"""
        if score_date is None:
            score_date = date.today()

        X = pd.DataFrame([features], columns=FEATURE_COLUMNS)
        quarterly_score = float(np.clip(self.model.predict(X)[0], 0, 1000))
        if cumulative_score is None:
            cumulative_score = quarterly_score
        final_score = quarterly_score * 0.7 + cumulative_score * 0.3

        # 카테고리별 점수
        fA = float(np.mean([features.get(c, 0) for c in FEATURE_COLUMNS[0:4]]))
        fB = float(np.mean([features.get(c, 0) for c in FEATURE_COLUMNS[4:8]]))
        fC = float(np.mean([features.get(c, 0) for c in FEATURE_COLUMNS[8:12]]))
        fD = float(np.mean([features.get(c, 0) for c in FEATURE_COLUMNS[12:16]]))

        # SHAP
        shap_vals = self.explainer.shap_values(X)[0]
        shap_dict = dict(zip(FEATURE_COLUMNS, [round(float(v), 4) for v in shap_vals]))
        top_improve = sorted(features.items(), key=lambda x: x[1])[:3]

        grade, emoji = self._get_grade(final_score)
        rate_discount = round(min(1.0, final_score / 1000.0), 2)

        return {
            "final_score": round(final_score, 1),
            "quarterly_score": round(quarterly_score, 1),
            "cumulative_score": round(cumulative_score, 1),
            "category_scores": {"fA": round(fA, 3), "fB": round(fB, 3), "fC": round(fC, 3), "fD": round(fD, 3)},
            "grade": grade, "grade_emoji": emoji,
            "shap": {**shap_dict, "top_improvement_features": [k for k, _ in top_improve]},
            "estimated_rate_discount": rate_discount,
            "model_version": MODEL_VERSION,
            "score_date": score_date.isoformat() if hasattr(score_date, "isoformat") else str(score_date),
        }

    def _get_grade(self, score: float) -> tuple:
        emoji_map = {"레전드": "🏆", "갓생": "⭐", "성실": "💪", "새싹": "🌱"}
        for grade, threshold in GRADE_THRESHOLDS.items():
            if score >= threshold:
                return grade, emoji_map[grade]
        return "새싹", "🌱"

    @staticmethod
    def normalize_mission_score(mission_code: str, raw_data: dict) -> float:
        """미션 코드와 원시값으로 정규화 점수(0.0~1.0) 산출"""
        code = mission_code.upper()
        try:
            if code == "A1":
                from datetime import datetime
                dt = datetime.fromisoformat(raw_data.get("wake_time_utc", "").replace("Z", "+00:00"))
                h = (dt.hour + 9) % 24 + dt.minute / 60.0
                return 1.0 if h <= 6 else (0.0 if h >= 10 else round(1.0 - (h - 6) / 4.0, 3))
            elif code == "A2":
                d = float(raw_data.get("sleep_duration_min", 0)) / 60.0
                return 1.0 if 7 <= d <= 8 else (max(0.0, round(d / 7.0, 3)) if d < 7 else max(0.0, round(1.0 - (d - 8) / 4.0, 3)))
            elif code == "A3":
                return 1.0 if raw_data.get("checkin_time_utc") else 0.0
            elif code == "A4":
                return round(min(1.0, int(raw_data.get("completed_count", 0)) / max(1, int(raw_data.get("total_active", 1)))), 3)
            elif code == "B1":
                return round(min(1.0, int(raw_data.get("update_count_30d", 0)) / 4.0), 3)
            elif code == "B2":
                arr = np.array(raw_data.get("monthly_incomes", [1]), dtype=float)
                return round(max(0.0, min(1.0, 1.0 - arr.std() / (arr.mean() + 1e-9))), 3) if len(arr) >= 2 else 0.5
            elif code == "B3":
                a, p = float(raw_data.get("actual_income", 1)), float(raw_data.get("predicted_income", 1))
                return round(max(0.0, min(1.0, 1.0 - abs(a - p) / (a + 1e-9))), 3)
            elif code == "B4":
                return round(min(1.0, int(raw_data.get("monthly_completion_count", 0)) / 3.0), 3)
            elif code == "C1":
                arr = np.array(raw_data.get("transaction_amounts", [1]), dtype=float)
                return round(max(0.0, min(1.0, 1.0 - min(arr.std() / (arr.mean() + 1e-9), 1.0))), 3) if len(arr) >= 2 else 0.5
            elif code == "C2":
                return round(max(0.0, 1.0 - int(raw_data.get("midnight_transaction_count", 0)) * 0.15), 3)
            elif code == "C3":
                return round(min(1.0, int(raw_data.get("grocery_count_this_month", 0)) / 4.0), 3)
            elif code == "C4":
                avg, fixed = float(raw_data.get("avg_balance", 0)), float(raw_data.get("fixed_expenses", 1))
                return round(min(1.0, max(0.0, (avg / (fixed + 1e-9) - 1.0) / 2.0)), 3)
            elif code == "D1":
                return round(max(min(1.0, int(raw_data.get("daily_steps", 0)) / 6000.0),
                                 min(1.0, int(raw_data.get("exercise_minutes", 0)) / 30.0)), 3)
            elif code == "D2":
                eco, total = int(raw_data.get("eco_transaction_count", 0)), int(raw_data.get("total_transaction_count", 1))
                return round(min(1.0, eco / max(1, total)), 3)
            elif code == "D3":
                cur, prev = float(raw_data.get("current_month_kwh", 1)), float(raw_data.get("previous_month_kwh", 1))
                return round(max(0.0, min(1.0, 0.5 + (prev - cur) / (prev + 1e-9))), 3)
            elif code == "D4":
                return 1.0 if raw_data.get("file_name") else 0.0
            else:
                return 0.0
        except Exception as e:
            logger.warning(f"정규화 점수 계산 오류 ({code}): {e}")
            return 0.5
