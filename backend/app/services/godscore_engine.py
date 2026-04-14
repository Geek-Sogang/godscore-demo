"""
app/services/godscore_engine.py
─────────────────────────────────────────────────────────
XGBoost 기반 갓생스코어 산출 엔진 + SHAP 설명력 산출.

[변경] 카테고리 내 미션별 가중치 도입
  - 이전: 카테고리 점수(fA~fD) = 4개 미션 단순 평균
  - 이후: 카테고리 점수(fA~fD) = 미션별 가중합 (Σ w_i × score_i)
  - 초기값: 행동경제학 연구 기반 가설값
  - 재학습: 분기 1회 XGBoost feature_importances_ 기반 자동 갱신
             급격한 변동 방지를 위해 70% 새 값 + 30% 기존값 블렌딩

분기 재학습 흐름:
  Celery Beat → engine.retrain(X_df, y) → 1) XGBoost 재학습
                                         → 2) feature_importances_ 추출
                                         → 3) 카테고리 내 가중치 갱신 (블렌딩)
                                         → 4) pickle 저장
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

# ── 피처 컬럼 정의 ─────────────────────────────────────
FEATURE_COLUMNS = [
    "A1_wake_score", "A2_sleep_score", "A3_checkin_score", "A4_mission_rate",        # fA
    "B1_portfolio_score", "B2_income_stability", "B3_income_predictability", "B4_work_completion",  # fB
    "C1_spending_regularity", "C2_impulse_control", "C3_grocery_score", "C4_balance_maintain",      # fC
    "D1_health_score", "D2_eco_score", "D3_energy_score", "D4_volunteer_score",                      # fD
]

# 카테고리별 컬럼 슬라이스
CATEGORY_SLICES = {
    "A": FEATURE_COLUMNS[0:4],
    "B": FEATURE_COLUMNS[4:8],
    "C": FEATURE_COLUMNS[8:12],
    "D": FEATURE_COLUMNS[12:16],
}

# ── 카테고리 간 가중치 (wA~wD) ─────────────────────────
CATEGORY_WEIGHTS = {"wA": 0.5, "wB": 0.4, "wC": 0.6, "wD": 0.3}
WEIGHT_SUM = sum(CATEGORY_WEIGHTS.values())

# ── 카테고리 내 미션별 초기 가중치 ────────────────────
# 행동경제학 연구 기반 가설값 — 분기 1회 XGBoost feature_importances_ 로 자동 재조정
# 각 카테고리 내 합계 = 1.0
INITIAL_INTRA_WEIGHTS: dict[str, float] = {
    # fA (생활 루틴): 기상·수면이 자기통제력의 핵심 지표
    "A1_wake_score":            0.30,  # 기상 인증 — 자기통제력의 가장 직접적 지표
    "A2_sleep_score":           0.30,  # 수면 규칙성 — 생체리듬 안정성
    "A3_checkin_score":         0.20,  # 앱 출석 일관성 — 습관 형성
    "A4_mission_rate":          0.20,  # 미션 달성률 — 전반적 실행력

    # fB (일·소득): 수입 예측 가능성이 상환 능력 판단의 핵심
    "B1_portfolio_score":       0.15,  # 포트폴리오 업데이트 — 간접 소득 증거
    "B2_income_stability":      0.30,  # 수입 변동성 — 낮을수록 안정 (역지표)
    "B3_income_predictability": 0.35,  # 수입 예측 가능성 — 상환 능력 가장 강한 선행 지표
    "B4_work_completion":       0.20,  # 업무 완료 인증 — 실질 업무 역량

    # fC (소비 행동): 충동 억제·잔고 유지가 연체 가능성 역지표
    "C1_spending_regularity":   0.25,  # 소비 패턴 규칙성 — 예측 가능한 지출
    "C2_impulse_control":       0.30,  # 충동 결제 억제 — 충동성 역지표 (핵심)
    "C3_grocery_score":         0.15,  # 식료품 구매 인증 — 필수 지출 관리
    "C4_balance_maintain":      0.30,  # 잔고 유지 — 상환 여력과 직결

    # fD (ESG): 자기관리가 ESG 내에서 금융 거동과 가장 상관 높음
    "D1_health_score":          0.30,  # 운동·자기관리 — 미래지향적 행동
    "D2_eco_score":             0.25,  # 대중교통·친환경 소비
    "D3_energy_score":          0.20,  # 에너지 절약 미션
    "D4_volunteer_score":       0.25,  # 봉사·기부 활동
}

GRADE_THRESHOLDS = {"레전드": 850, "갓생": 650, "성실": 400, "새싹": 0}
MODEL_VERSION = "v2.0"  # 카테고리 내 가중치 도입으로 버전 업


class GodScoreEngine:
    """XGBoost 기반 갓생스코어 산출 엔진 (싱글톤)"""

    def __init__(self, model_path: str = "app/services/models/godscore_xgb.pkl"):
        self.model_path = Path(model_path)
        self.model = None
        self.explainer = None
        # 카테고리 내 미션별 가중치 (초기값으로 시작, 분기 재학습 시 갱신)
        self.intra_weights: dict[str, float] = dict(INITIAL_INTRA_WEIGHTS)
        self._load_or_train()

    # ── 모델 로드 / 초기 학습 ─────────────────────────

    def _load_or_train(self) -> None:
        if self.model_path.exists():
            logger.info(f"✅ XGBoost 모델 로드: {self.model_path}")
            with open(self.model_path, "rb") as f:
                saved = pickle.load(f)
                self.model = saved["model"]
                self.explainer = saved["explainer"]
                # v2.0부터 intra_weights 포함 — 없으면 초기값 유지
                if "intra_weights" in saved:
                    self.intra_weights = saved["intra_weights"]
                    logger.info("📊 카테고리 내 미션별 가중치 로드 완료")
                else:
                    logger.info("📊 구버전 모델 감지 → 초기 intra_weights 사용")
        else:
            logger.info("⚙️  합성 데이터로 XGBoost 초기 학습 시작")
            self._train_with_synthetic_data()

    def _train_with_synthetic_data(self) -> None:
        """합성 데이터로 XGBoost 초기 학습 (실제 데이터 없이 데모 동작)"""
        np.random.seed(42)
        n = 5000
        X = pd.DataFrame(
            np.random.uniform(0, 1, (n, len(FEATURE_COLUMNS))),
            columns=FEATURE_COLUMNS,
        )

        # 목표값 생성: 초기 intra_weights 적용 가중합 기반
        # (단순 평균 대신 가중합으로 생성 → 모델이 초기부터 가중치 구조 학습)
        fA = self._weighted_sum_from_df(X, "A")
        fB = self._weighted_sum_from_df(X, "B")
        fC = self._weighted_sum_from_df(X, "C")
        fD = self._weighted_sum_from_df(X, "D")
        wA = CATEGORY_WEIGHTS["wA"]
        wB = CATEGORY_WEIGHTS["wB"]
        wC = CATEGORY_WEIGHTS["wC"]
        wD = CATEGORY_WEIGHTS["wD"]
        y = np.clip(
            (wA * fA + wB * fB + wC * fC + wD * fD) / WEIGHT_SUM * 1000
            + np.random.normal(0, 20, n),
            0, 1000,
        )

        self.model = xgb.XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1,
        )
        self.model.fit(X, y)
        self.explainer = shap.TreeExplainer(self.model)

        # 학습 직후 feature_importances_ 기반으로 intra_weights 첫 갱신
        self._update_intra_weights_from_importance(blend_ratio=1.0)  # 초기 학습: 100% 새 값

        self._save()
        logger.info(f"✅ 초기 학습 완료 → {self.model_path}")

    # ── 분기 재학습 (Public API) ──────────────────────

    def retrain(self, X_df: pd.DataFrame, y: np.ndarray) -> dict:
        """
        분기 1회 전체 재학습.
        실서비스: Celery Beat가 최근 90일 mission_logs를 집계 후 호출.

        Args:
            X_df: 피처 DataFrame (columns = FEATURE_COLUMNS)
            y:    목표값 배열 (실제 대출 상환 여부 or 기존 갓생스코어)

        Returns:
            { "old_weights": ..., "new_weights": ..., "delta": ... }
        """
        old_weights = dict(self.intra_weights)

        # XGBoost 재학습
        self.model.fit(X_df, y, verbose=False)
        self.explainer = shap.TreeExplainer(self.model)

        # feature_importances_ 기반 intra_weights 갱신 (블렌딩)
        self._update_intra_weights_from_importance(blend_ratio=0.7)

        self._save()

        delta = {k: round(self.intra_weights[k] - old_weights[k], 4) for k in old_weights}
        logger.info(f"🔄 분기 재학습 완료. 가중치 변동: {delta}")
        return {
            "old_weights": old_weights,
            "new_weights": dict(self.intra_weights),
            "delta": delta,
        }

    # ── 점수 산출 ─────────────────────────────────────

    def calculate(
        self,
        features: dict,
        score_date=None,
        cumulative_score=None,
    ) -> dict:
        """피처 딕셔너리 → 갓생스코어 + SHAP + 카테고리 점수 반환"""
        if score_date is None:
            score_date = date.today()

        X = pd.DataFrame([features], columns=FEATURE_COLUMNS)
        quarterly_score = float(np.clip(self.model.predict(X)[0], 0, 1000))
        if cumulative_score is None:
            cumulative_score = quarterly_score
        final_score = quarterly_score * 0.7 + cumulative_score * 0.3

        # ── [핵심 변경] 카테고리별 점수: 단순 평균 → 미션별 가중합 ──
        fA = self._weighted_category_score(features, "A")
        fB = self._weighted_category_score(features, "B")
        fC = self._weighted_category_score(features, "C")
        fD = self._weighted_category_score(features, "D")

        # SHAP
        shap_vals = self.explainer.shap_values(X)[0]
        shap_dict = dict(zip(FEATURE_COLUMNS, [round(float(v), 4) for v in shap_vals]))
        top_improve = sorted(features.items(), key=lambda x: x[1])[:3]

        grade, emoji = self._get_grade(final_score)
        rate_discount = round(min(1.0, final_score / 1000.0), 2)

        return {
            "final_score":        round(final_score, 1),
            "quarterly_score":    round(quarterly_score, 1),
            "cumulative_score":   round(cumulative_score, 1),
            "category_scores": {
                "fA": round(fA, 3),
                "fB": round(fB, 3),
                "fC": round(fC, 3),
                "fD": round(fD, 3),
            },
            # 현재 사용 중인 카테고리 내 가중치도 응답에 포함
            # → 프론트에서 "왜 이 점수인가" 설명에 활용 가능
            "intra_weights": dict(self.intra_weights),
            "grade":              grade,
            "grade_emoji":        emoji,
            "shap": {
                **shap_dict,
                "top_improvement_features": [k for k, _ in top_improve],
            },
            "estimated_rate_discount": rate_discount,
            "model_version":      MODEL_VERSION,
            "score_date": (
                score_date.isoformat()
                if hasattr(score_date, "isoformat")
                else str(score_date)
            ),
        }

    # ── 내부 유틸 ─────────────────────────────────────

    def _weighted_category_score(self, features: dict, category: str) -> float:
        """
        카테고리 내 미션별 가중합 산출 (0.0~1.0).

        수식: fX = Σ(w_i × score_i) / Σ(w_i)
        가중치 합이 0이면 단순 평균으로 폴백.
        """
        cols = CATEGORY_SLICES[category]
        total_w = sum(self.intra_weights[c] for c in cols)
        if total_w < 1e-9:
            # 폴백: 단순 평균 (가중치 전부 0인 극단 상황)
            return float(np.mean([features.get(c, 0.0) for c in cols]))
        return sum(features.get(c, 0.0) * self.intra_weights[c] for c in cols) / total_w

    @staticmethod
    def _weighted_sum_from_df(X: pd.DataFrame, category: str) -> pd.Series:
        """DataFrame 기반 카테고리 가중합 (초기 학습 목표값 생성용)"""
        cols = CATEGORY_SLICES[category]
        total_w = sum(INITIAL_INTRA_WEIGHTS[c] for c in cols)
        return sum(X[c] * INITIAL_INTRA_WEIGHTS[c] for c in cols) / total_w

    def _update_intra_weights_from_importance(self, blend_ratio: float = 0.7) -> None:
        """
        XGBoost feature_importances_ → 카테고리 내 미션별 가중치 갱신.

        알고리즘:
          1. feature_importances_ 추출 (각 피처가 예측에 기여하는 비중)
          2. 카테고리 내 정규화: 카테고리 내 합계 = 1.0
          3. 블렌딩: new = blend_ratio × importance기반 + (1-blend_ratio) × 기존값
             → 급격한 가중치 변동 방지 (분기 단위 완만한 재조정)

        Args:
            blend_ratio: 새 가중치 반영 비율 (초기학습: 1.0, 분기재학습: 0.7)
        """
        importances = dict(zip(FEATURE_COLUMNS, self.model.feature_importances_))

        for category, cols in CATEGORY_SLICES.items():
            # 카테고리 내 각 피처의 importance (최소 1e-9 보정)
            raw = {c: max(float(importances.get(c, 0.0)), 1e-9) for c in cols}
            total = sum(raw.values())
            # 카테고리 내 정규화
            normalized = {c: v / total for c, v in raw.items()}

            # 블렌딩 적용
            for c in cols:
                self.intra_weights[c] = round(
                    blend_ratio * normalized[c]
                    + (1.0 - blend_ratio) * self.intra_weights[c],
                    4,
                )

        logger.info(
            f"📊 intra_weights 갱신 (blend={blend_ratio:.0%}) | "
            f"A: {[round(self.intra_weights[c],3) for c in CATEGORY_SLICES['A']]} | "
            f"B: {[round(self.intra_weights[c],3) for c in CATEGORY_SLICES['B']]}"
        )

    def _save(self) -> None:
        """모델 + intra_weights pickle 저장"""
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump({
                "model":         self.model,
                "explainer":     self.explainer,
                "intra_weights": self.intra_weights,   # v2.0 신규
            }, f)

    def _get_grade(self, score: float) -> tuple:
        emoji_map = {"레전드": "🏆", "갓생": "⭐", "성실": "💪", "새싹": "🌱"}
        for grade, threshold in GRADE_THRESHOLDS.items():
            if score >= threshold:
                return grade, emoji_map[grade]
        return "새싹", "🌱"

    # ── 미션별 정규화 점수 산출 ───────────────────────

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
                return round(max(
                    min(1.0, int(raw_data.get("daily_steps", 0)) / 6000.0),
                    min(1.0, int(raw_data.get("exercise_minutes", 0)) / 30.0),
                ), 3)
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
