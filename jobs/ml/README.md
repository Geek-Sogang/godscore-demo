# jobs/ml — 하나은행 ML 배치 파이프라인

> **앱 서버(services/api)와 완전히 분리된** 은행 내부 전용 파이프라인

## 역할 분리

| 구분 | 위치 | 역할 |
|------|------|------|
| 앱 API 서버 | `services/api/` | 미션 제출 수신, 갓생스코어 **추론** 제공 |
| ML 배치 파이프라인 | `jobs/ml/` ← **여기** | XGBoost **재학습**, 가중치 갱신, 리더보드 배치 |

## 파일 구성

```
jobs/ml/
├── retrain.py       # 분기별 XGBoost 재학습 메인
├── synthetic_data.py # 합성 훈련 데이터 생성 (Mock)
└── schedule.py      # Celery Beat 스케줄 정의
```

## 실행 주기

| 잡 | 주기 | 내용 |
|----|------|------|
| `quarterly_retrain` | 분기 1회 (1/4/7/10월 1일 02:00 KST) | XGBoost 재학습 → wA~wD 가중치 갱신 |
| `daily_godscore_batch` | 매일 00:05 KST | 최근 90일 이동평균 갓생스코어 재산출 → Redis 리더보드 |
| `weekly_model_eval` | 매주 월요일 03:00 KST | 모델 AUC 모니터링 |

## 데모 실행 (합성 데이터)

```bash
cd jobs/ml
pip install xgboost scikit-learn pandas numpy celery redis

# 분기 재학습 즉시 실행 (Mock 모드)
python retrain.py
```

## 실서비스 연동 시

`retrain.py`의 주석 처리된 DB 연동 코드 활성화:
```python
# result = run_retraining(X=load_from_db(), y=load_labels_from_db())
result = run_retraining(use_synthetic=True)  # ← 이 줄 제거
```
