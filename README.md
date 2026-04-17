# 하나 더 (Hana More) — 갓생스코어 앱 데모 🌱

**"소득 증빙이 어려운 긱워커를 위한 블록체인 기반 대안신용평가 플랫폼"**

> 본 프로젝트는 하나은행 공모전 출품작의 프론트엔드/도메인 로직 프로토타입(Demo Ver.1)입니다.

---

## 🎯 프로젝트 개요

**하나 더 (Hana More)**는 프리랜서·긱워커 등 정규 소득 증빙이 어려워 기존 금융권 신용평가에서 소외된 계층을 위한 대안신용평가 플랫폼입니다.

사용자의 일상 활동과 금융 패턴을 4가지 핵심 행동 피처(Feature)로 수집하고, 머신러닝 가중치 기반으로 **갓생점수(God-Saeng Score)**를 산출합니다.

---

## ✨ 주요 기능

### 1. 4가지 행동 피처 수집

| 타입 | 카테고리 | 수집 데이터 |
|------|----------|-------------|
| **Type A** | 생활 루틴 | 기상 시간, 수면 규칙성, 앱 출석, 미션 달성률 |
| **Type B** | 일·소득 | 포트폴리오 업로드, 소득 변동성, 업무 완료 인증 |
| **Type C** | 소비 행동 | 소비 패턴 규칙성, 새벽 충동 결제, 잔고 유지 여부 |
| **Type D** | 개인 ESG | 대중교통 이용, 에너지 절약, 운동/기부 활동 |

### 2. 실시간 갓생점수 산출 (ML Mock 엔진)

- XGBoost 구조를 차용한 가중치 기반 계산식 (분기별 재학습 구조)
- SHAP Value 개념 도입 — 어떤 행동이 점수에 영향을 주었는지 투명하게 제공

### 3. 블록체인 데이터 무결성 파이프라인

- 미션 완료 데이터를 해시 후 온체인 기록 (현재: Mock 파이프라인)
- Keccak256/SHA-256 클라이언트 해시로 위변조 감지

---

## 🛠 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React Native (Expo SDK 52) + TypeScript Strict |
| 상태 관리 | Zustand + Immer |
| 스타일링 | NativeWind v4 (Tailwind CSS) |
| 아키텍처 | Clean Architecture (Domain / Application / Infrastructure / Presentation) |
| 백엔드 | FastAPI + Uvicorn |
| ML 엔진 | XGBoost + SHAP + Prophet |
| 데이터베이스 | PostgreSQL (Supabase) — Mock 파이프라인 |
| 배치/스케줄링 | Celery Beat + Redis |

---

## 🚀 실행 방법 (Getting Started)

### 📱 프론트엔드 (Mobile App)

```bash
# 의존성 설치
npm install

# 앱 실행 (iOS / Android / Web)
npx expo start
```

> **팁:** 웹 브라우저에서 테스트 시 창 너비를 **390px~480px**로 좁혀 모바일 UI로 확인하시기 바랍니다.

### ⚙️ 백엔드 (API Server)

```bash
cd backend

# 가상환경 구축 및 의존성 설치
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 서버 실행
python -m app.main
```

---

## 📁 폴더 구조 (Project Structure)

```
.
├── app/                  # Expo Router (페이지 구성)
├── assets/               # 폰트 및 이미지 리소스
├── backend/              # FastAPI 백엔드 및 ML 로직
│   ├── app/              # API 라우터 및 서비스
│   └── scripts/          # ML 모델 초기화 및 데이터 생성
├── src/                  # 클린 아키텍처 핵심 로직
│   ├── domain/           # 엔티티 및 유즈케이스 (비즈니스 룰)
│   ├── application/      # 스토어 및 커스텀 훅
│   ├── infrastructure/   # API 클라이언트 및 외부 연동
│   └── presentation/     # 재사용 가능한 UI 컴포넌트 및 스크린
└── types/                # 글로벌 타입 정의
```

---

## 💡 데모 시나리오

1. **미션 센터** — 생활 루틴이나 업무 인증 미션을 완료하여 포인트를 획득합니다.
2. **갓생점수 확인** — 홈 화면에서 실시간으로 반영되는 갓생점수를 확인합니다.
3. **금융 리포트** — 점수 변화 요인(SHAP 분석)을 확인하고, 하나은행 금리 우대 혜택을 시뮬레이션합니다.
4. **스토어** — 획득한 코인으로 나만의 작업실 아이템을 구매하여 꾸밉니다.

---

## 👥 팀 짱사이트 (Team)

| 이름 | 역할 |
|------|------|
| 구준모 | 팀장 |
| 권유철 | 팀원 |
| 조대흠 | 팀원 |
| 한민영 | 팀원 |

---

> 하나 청년 금융인재 양성 프로젝트 2026 출품작
