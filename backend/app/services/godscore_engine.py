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
        self.intra_weights: dict[str, float] = dict(INITIAL_INTRA_WEIGHTS)
        # 폴백 모드: 모델 없을 때 XGBoost 없이 수동 가중합으로 동작
        # 서버 시작 시 즉석 학습 → API 블로킹 문제 방지
        # 초기 모델은 'python backend/scripts/init_model.py' 로 별도 생성
        self._fallback_mode = False
        self._load_model()

    # ── 모델 로드 (추론 전용) ─────────────────────────
    # 훈련과 추론은 완전히 분리됩니다:
    #   추론(Inference): 이 메서드 — 서버 시작 시 pkl 로드만
    #   훈련(Training):  backend/scripts/init_model.py — 서버와 독립 실행

    def _load_model(self) -> None:
        """pkl 파일 로드. 없으면 폴백 모드로 전환 (API 블로킹 없음)"""
        if self.model_path.exists():
            logger.info(f"✅ XGBoost 모델 로드: {self.model_path}")
            with open(self.model_path, "rb") as f:
                saved = pickle.load(f)
                self.model     = saved["model"]
                self.explainer = saved["explainer"]
                if "intra_weights" in saved:
                    self.intra_weights = saved["intra_weights"]
                    logger.info("📊 카테고리 내 미션별 가중치 로드 완료")
                else:
                    logger.info("📊 구버전 모델 감지 → 초기 intra_weights 사용")
        else:
            logger.warning(
                "⚠️  XGBoost 모델 파일 없음 → 폴백 모드로 시작\n"
                "   점수 = 수동 가중합 (XGBoost 미사용, SHAP 미지원)\n"
                "   모델 생성: python backend/scripts/init_model.py"
            )
            self._fallback_mode = True

    # ── 재학습(retrain) 메서드 분리 안내 ──────────────────────────────
    # XGBoost 재학습 및 가중치 갱신은 은행 내부 배치 파이프라인에서 실행.
    # 앱 서버는 추론(inference)만 담당 → jobs/ml/retrain.py 참조.
    # ─────────────────────────────────────────────────────────────────

    def calculate(
        self,
        features: dict,
        score_date=None,
        cumulative_score=None,
    ) -> dict:
        """
        피처 딕셔너리 → 갓생스코어 + SHAP + 카테고리 점수 반환.
        폴백 모드(모델 없음)에서도 수동 가중합으로 정상 응답합니다.
        """
        if score_date is None:
            score_date = date.today()

        fA = self._weighted_category_score(features, "A")
        fB = self._weighted_category_score(features, "B")
        fC = self._weighted_category_score(features, "C")
        fD = self._weighted_category_score(features, "D")

        if self._fallback_mode:
            # ── 폴백 모드: XGBoost 없이 수동 가중합 ──────────────────
            # SHAP 미지원, 점수는 단순 가중합으로 산출
            wA = CATEGORY_WEIGHTS["wA"]
            wB = CATEGORY_WEIGHTS["wB"]
            wC = CATEGORY_WEIGHTS["wC"]
            wD = CATEGORY_WEIGHTS["wD"]
            quarterly_score = np.clip(
                (wA * fA + wB * fB + wC * fC + wD * fD) / WEIGHT_SUM * 1000,
                0, 1000,
            )
            shap_dict = {col: 0.0 for col in FEATURE_COLUMNS}
            top_improve = sorted(features.items(), key=lambda x: x[1])[:3]
            shap_dict["top_improvement_features"] = [k for k, _ in top_improve]
            logger.debug("폴백 모드로 점수 산출 (XGBoost 미사용)")
        else:
            # ── 정상 모드: XGBoost 추론 + SHAP ───────────────────────
            X = pd.DataFrame([features], columns=FEATURE_COLUMNS)
            quarterly_score = float(np.clip(self.model.predict(X)[0], 0, 1000))
            shap_vals = self.explainer.shap_values(X)[0]
            shap_dict = dict(zip(FEATURE_COLUMNS, [round(float(v), 4) for v in shap_vals]))
            top_improve = sorted(features.items(), key=lambda x: x[1])[:3]
            shap_dict["top_improvement_features"] = [k for k, _ in top_improve]

        quarterly_score = float(quarterly_score)
        if cumulative_score is None:
            cumulative_score = quarterly_score
        final_score = quarterly_score * 0.7 + cumulative_score * 0.3

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
            "intra_weights":           dict(self.intra_weights),
            "grade":                   grade,
            "grade_emoji":             emoji,
            "shap":                    shap_dict,
            "estimated_rate_discount": rate_discount,
            "fallback_mode":           self._fallback_mode,
            "model_version":           MODEL_VERSION,
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

    def _get_grade(self, score: float) -> tuple:
        emoji_map = {"레전드": "🏆", "갓생": "⭐", "성실": "💪", "새싹": "🌱"}
        for grade, threshold in GRADE_THRESHOLDS.items():
            if score >= threshold:
                return grade, emoji_map[grade]
        return "새싹", "🌱"

    # ── 미션별 정규화 점수 산출 ───────────────────────

    @staticmethod
    def normalize_mission_score(mission_code: str, raw_data: dict) -> float:
        """
        미션 코드 + 원시 데이터 → 정규화 점수(0.0~1.0) 산출.

        [리팩터] if-elif 스파게티 → Strategy Pattern (딕셔너리 디스패치)
          - 미션이 늘어나도 _MISSION_SCORERS 에 함수만 추가하면 됨
          - 각 미션 로직이 독립 함수 → 단위 테스트 가능
          - 알 수 없는 코드 → 0.0 반환 (에러 아님, 명시적 기본값)
        """
        code = mission_code.upper()
        scorer = _MISSION_SCORERS.get(code)
        if scorer is None:
            logger.warning(f"알 수 없는 미션 코드: {code}")
            return 0.0
        try:
            return scorer(raw_data)
        except Exception as exc:
            logger.warning(f"정규화 점수 계산 오류 ({code}): {exc}")
            return 0.5


# ── 미션별 정규화 스코어러 ──────────────────────────────────────────
# Strategy Pattern: 각 미션 코드 → 독립 함수
# 새 미션 추가 시 함수를 작성하고 _MISSION_SCORERS 에 등록만 하면 됩니다.
# GodScoreEngine.normalize_mission_score() 본체는 건드리지 않아도 됩니다.
from datetime import datetime as _dt


def _score_a1(raw: dict) -> float:
    """기상 인증: KST 기상 시각 → 이른 기상일수록 높은 점수 (6시 이전 = 만점)"""
    dt = _dt.fromisoformat(raw.get("wake_time_utc", "").replace("Z", "+00:00"))
    h = (dt.hour + 9) % 24 + dt.minute / 60.0   # UTC → KST 변환
    if h <= 6:   return 1.0
    if h >= 10:  return 0.0
    return round(1.0 - (h - 6) / 4.0, 3)         # 6~10시: 선형 감소


def _score_a2(raw: dict) -> float:
    """수면 규칙성: 7~8시간 수면 = 만점, 그 외 선형 감소"""
    d = float(raw.get("sleep_duration_min", 0)) / 60.0
    if 7 <= d <= 8:  return 1.0
    if d < 7:        return max(0.0, round(d / 7.0, 3))
    return max(0.0, round(1.0 - (d - 8) / 4.0, 3))


def _score_a3(raw: dict) -> float:
    """앱 출석 일관성: 체크인 존재 여부"""
    return 1.0 if raw.get("checkin_time_utc") else 0.0


def _score_a4(raw: dict) -> float:
    """미션 달성률: 완료 수 / 전체 활성 미션 수"""
    completed = int(raw.get("completed_count", 0))
    total     = max(1, int(raw.get("total_active", 1)))
    return round(min(1.0, completed / total), 3)


def _score_b1(raw: dict) -> float:
    """포트폴리오 업데이트: 최근 30일 4회 이상 = 만점"""
    return round(min(1.0, int(raw.get("update_count_30d", 0)) / 4.0), 3)


def _score_b2(raw: dict) -> float:
    """수입 안정성: 변동계수(CV) 낮을수록 높은 점수"""
    arr = np.array(raw.get("monthly_incomes", [1]), dtype=float)
    if len(arr) < 2:
        return 0.5
    cv = arr.std() / (arr.mean() + 1e-9)   # 변동계수
    return round(max(0.0, min(1.0, 1.0 - cv)), 3)


def _score_b3(raw: dict) -> float:
    """수입 예측 가능성: 실제 vs 예측 수입 MAPE 역산"""
    actual    = float(raw.get("actual_income", 1))
    predicted = float(raw.get("predicted_income", 1))
    mape = abs(actual - predicted) / (actual + 1e-9)
    return round(max(0.0, min(1.0, 1.0 - mape)), 3)


def _score_b4(raw: dict) -> float:
    """업무 완료 인증: 월 3건 이상 = 만점"""
    return round(min(1.0, int(raw.get("monthly_completion_count", 0)) / 3.0), 3)


def _score_c1(raw: dict) -> float:
    """소비 패턴 규칙성: 결제 금액 변동계수 낮을수록 높은 점수"""
    arr = np.array(raw.get("transaction_amounts", [1]), dtype=float)
    if len(arr) < 2:
        return 0.5
    cv = arr.std() / (arr.mean() + 1e-9)
    return round(max(0.0, min(1.0, 1.0 - min(cv, 1.0))), 3)


def _score_c2(raw: dict) -> float:
    """충동 결제 억제: 새벽 결제 횟수 1건당 -0.15점"""
    midnight_count = int(raw.get("midnight_transaction_count", 0))
    return round(max(0.0, 1.0 - midnight_count * 0.15), 3)


def _score_c3(raw: dict) -> float:
    """식료품 구매 인증: 월 4회 이상 = 만점"""
    return round(min(1.0, int(raw.get("grocery_count_this_month", 0)) / 4.0), 3)


def _score_c4(raw: dict) -> float:
    """잔고 유지: 평균잔고 / 고정지출 비율 (2배 이상 = 만점)"""
    avg_balance   = float(raw.get("avg_balance", 0))
    fixed_expenses = float(raw.get("fixed_expenses", 1))
    ratio = avg_balance / (fixed_expenses + 1e-9)
    # 비율 1 미만 = 0점, 비율 3 이상 = 만점 (선형 보간)
    return round(min(1.0, max(0.0, (ratio - 1.0) / 2.0)), 3)


def _score_d1(raw: dict) -> float:
    """운동·자기관리: 걸음수 6000보 또는 운동 30분 중 높은 쪽"""
    steps_score   = min(1.0, int(raw.get("daily_steps", 0)) / 6000.0)
    exercise_score = min(1.0, int(raw.get("exercise_minutes", 0)) / 30.0)
    return round(max(steps_score, exercise_score), 3)


def _score_d2(raw: dict) -> float:
    """친환경 소비: 친환경 결제 / 전체 결제 비율"""
    eco   = int(raw.get("eco_transaction_count", 0))
    total = max(1, int(raw.get("total_transaction_count", 1)))
    return round(min(1.0, eco / total), 3)


def _score_d3(raw: dict) -> float:
    """에너지 절약: 전월 대비 사용량 감소율 (0.5 = 현상유지, 1.0 = 완전절약)"""
    current  = float(raw.get("current_month_kwh", 1))
    previous = float(raw.get("previous_month_kwh", 1))
    reduction = (previous - current) / (previous + 1e-9)  # 감소율 (-inf ~ 1.0)
    return round(max(0.0, min(1.0, 0.5 + reduction)), 3)


def _score_d4(raw: dict) -> float:
    """봉사·기부 활동: 파일 첨부 여부"""
    return 1.0 if raw.get("file_name") else 0.0


# 미션 코드 → 스코어러 함수 매핑
# 새 미션 추가: 함수 작성 후 여기에 등록
_MISSION_SCORERS: dict[str, object] = {
    "A1": _score_a1,
    "A2": _score_a2,
    "A3": _score_a3,
    "A4": _score_a4,
    "B1": _score_b1,
    "B2": _score_b2,
    "B3": _score_b3,
    "B4": _score_b4,
    "C1": _score_c1,
    "C2": _score_c2,
    "C3": _score_c3,
    "C4": _score_c4,
    "D1": _score_d1,
    "D2": _score_d2,
    "D3": _score_d3,
    "D4": _score_d4,
}
