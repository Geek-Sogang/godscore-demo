"""
backend/scripts/init_model.py
─────────────────────────────────────────────
XGBoost 모델 초기 학습 스크립트.

서버 시작 전 1회 실행해 pkl 파일을 생성합니다.
  $ cd backend
  $ python scripts/init_model.py

[훈련/추론 분리 원칙]
  - 서버(app/main.py): 모델 로드만 담당 → API 블로킹 없음
  - 이 스크립트: 모델 학습 담당 → 서버와 독립 실행

  Scale-out 환경에서는:
    1. 이 스크립트를 CI/CD 파이프라인에서 1회 실행
    2. 생성된 pkl 파일을 공유 스토리지(S3 등)에 업로드
    3. 모든 서버 인스턴스가 동일한 pkl을 로드
    → 서버마다 다른 모델로 인한 점수 불일치 방지
"""
import sys
import os
import time

# backend/ 폴더를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.godscore_engine import GodScoreEngine, FEATURE_COLUMNS
import numpy as np
import pandas as pd


def main():
    print("=" * 50)
    print("🚀 하나 더 GodScore 모델 초기 학습")
    print("=" * 50)

    model_path = "app/services/models/godscore_xgb.pkl"

    if os.path.exists(model_path):
        overwrite = input(f"⚠️  모델 파일이 이미 존재합니다: {model_path}\n덮어쓰시겠습니까? (y/N): ")
        if overwrite.lower() != "y":
            print("취소됨.")
            return

    print("\n📊 합성 학습 데이터 생성 중...")
    start = time.time()

    # 엔진 초기화 (폴백 모드로 시작)
    engine = GodScoreEngine(model_path=model_path)
    print(f"   폴백 모드: {engine._fallback_mode}")

    # 합성 데이터로 초기 학습
    print("\n⚙️  XGBoost 학습 중 (5,000 샘플)...")
    engine._train_with_synthetic_data()

    elapsed = time.time() - start
    print(f"\n✅ 학습 완료! ({elapsed:.1f}초)")
    print(f"   저장 경로: {model_path}")
    print(f"   폴백 모드: {engine._fallback_mode}")

    # 검증 테스트
    print("\n🧪 추론 테스트...")
    test_features = {col: np.random.uniform(0.4, 0.8) for col in FEATURE_COLUMNS}
    result = engine.calculate(test_features)
    print(f"   갓생점수: {result['final_score']}점 ({result['grade']})")
    print(f"   카테고리: fA={result['category_scores']['fA']:.3f}, "
          f"fB={result['category_scores']['fB']:.3f}, "
          f"fC={result['category_scores']['fC']:.3f}, "
          f"fD={result['category_scores']['fD']:.3f}")
    print("\n🎉 서버를 시작할 준비가 됐습니다!")
    print("   $ uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    main()
