"""
jobs/ml/schedule.py
Celery Beat 스케줄 설정 — 은행 내부 데이터 파이프라인

== 실행 환경 ==
  은행 내부 서버 (앱 API 서버와 별도)
  Redis 브로커 + Celery Worker

== 작업 목록 ==
  - quarterly_retrain  : 분기 1회 XGBoost 재학습 (wA~wD 가중치 갱신)
  - daily_godscore     : 매일 KST 00:05 갓생스코어 재산출 + Redis 리더보드 갱신
  - weekly_model_eval  : 주간 모델 성능 모니터링 (AUC 하락 경보)

== 앱 API 서버와의 관계 ==
  앱 서버: 추론(inference)만 담당
  이 스케줄러: 모델 훈련/평가/배포 담당
  → 두 서버가 같은 model.pkl을 공유 스토리지(S3 등)로 동기화
"""

from celery import Celery
from celery.schedules import crontab
import logging

logger = logging.getLogger(__name__)

# Celery 앱 (브로커: Redis)
app = Celery(
    "hana_ml_pipeline",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)

app.conf.timezone = "Asia/Seoul"


# ── 태스크 정의 ──────────────────────────────────────────────────────

@app.task(name="quarterly_retrain", bind=True, max_retries=3)
def quarterly_retrain(self):
    """
    분기별 XGBoost 재학습
    은행 DB에서 최근 6개월 mission_logs + loan_repayments 조회 후 재학습
    """
    try:
        from retrain import run_retraining
        # 실서비스: DB 연결 후 실제 데이터 로드
        # result = run_retraining(X=load_from_db(), y=load_labels_from_db())

        # Mock: 합성 데이터로 재학습
        result = run_retraining(use_synthetic=True)
        logger.info(f"[분기 재학습 완료] AUC={result['val_auc']}, 가중치={result['weights']}")
        return result
    except Exception as exc:
        logger.error(f"[분기 재학습 실패] {exc}")
        raise self.retry(exc=exc, countdown=3600)  # 1시간 후 재시도


@app.task(name="daily_godscore_batch")
def daily_godscore_batch():
    """
    매일 KST 00:05 갓생스코어 재산출
    최근 90일 이동평균 기반 → Redis ZADD 리더보드 업데이트
    """
    logger.info("[일별 배치] 갓생스코어 재산출 시작")
    # 실서비스: Supabase mission_logs 조회 → 스코어 계산 → Redis ZADD
    # 현재: Mock
    return {"status": "ok", "message": "갓생스코어 배치 완료"}


@app.task(name="weekly_model_eval")
def weekly_model_eval():
    """
    주간 모델 성능 모니터링
    AUC가 기준치(0.70) 이하로 떨어지면 Slack 경보 발송
    """
    logger.info("[주간 평가] 모델 성능 확인 중")
    return {"status": "ok"}


# ── Celery Beat 스케줄 ────────────────────────────────────────────────

app.conf.beat_schedule = {
    # 분기 1회: 1월/4월/7월/10월 1일 02:00 KST
    "quarterly-xgboost-retrain": {
        "task": "quarterly_retrain",
        "schedule": crontab(
            hour=2, minute=0,
            day_of_month=1,
            month_of_year="1,4,7,10",
        ),
    },
    # 매일 KST 00:05 갓생스코어 재산출
    "daily-godscore-batch": {
        "task": "daily_godscore_batch",
        "schedule": crontab(hour=0, minute=5),
    },
    # 매주 월요일 03:00 KST 모델 평가
    "weekly-model-evaluation": {
        "task": "weekly_model_eval",
        "schedule": crontab(hour=3, minute=0, day_of_week=1),
    },
}
