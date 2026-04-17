# 하나 더 (Hana More) — 갓생스코어 앱 데모 🌱

> **"소득 증빙이 어려운 긱워커를 위한 블록체인 기반 대안신용평가 플랫폼"**

본 프로젝트는 **하나 청년 금융인재 양성 프로젝트 2026** 출품작의 프론트엔드/도메인 로직 프로토타입 (Demo Ver.1)입니다.  
팀 **짱사이트** (서강대학교) — 구준모 · 권유철 · 조대흠 · 한민영

---

## 🎯 프로젝트 개요

**하나 더 (Hana More)** 는 프리랜서·긱워커 등 정규 소득 증빙이 어려워 기존 금융권 신용평가에서 소외된 계층을 위한 대안신용평가 플랫폼입니다.

사용자의 일상 활동과 금융 패턴을 **4가지 핵심 행동 피처(Feature)** 로 수집하고, 머신러닝 가중치 기반으로 **갓생점수(God-Saeng Score)** 를 산출합니다. 이 점수는 하나은행 대출 금리 우대 혜택으로 직접 연결됩니다.

---

## ✨ 주요 기능

### 1. 4가지 행동 피처 수집

| 타입 | 카테고리 | 수집 데이터 |
|------|----------|------------|
| Type A | 생활 루틴 | 기상 시간, 수면 규칙성, 앱 출석, 미션 달성률 |
| Type B | 일·소득 | 포트폴리오 업로드, 소득 변동성, 업무 완료 인증 |
| Type C | 소비 행동 | 소비 패턴 규칙성, 새벽 충동 결제, 잔고 유지 여부 |
| Type D | 개인 ESG | 대중교통 이용, 에너지 절약, 운동/기부 활동 |

### 2. 실시간 갓생점수 산출 (XGBoost 기반 ML 엔진)

- **XGBoost** 구조를 차용한 가중치 기반 계산식 (분기별 자동 재학습 구조)
- **SHAP Value** 도입 — 어떤 행동이 점수에 기여했는지 투명하게 제공
- **Prophet** 기반 소득 흐름 예측으로 미래 신용 리스크 선제 분석

```
S = wA·fA + wB·fB + wC·fC + wD·fD

카테고리 가중치 (초기값 / 행동경제학 기반 가설)
  wA (생활 루틴)  = 0.30  ← 자기통제력
  wB (일·소득)   = 0.35  ← 상환 능력
  wC (소비 행동)  = 0.25  ← 충동성
  wD (ESG)      = 0.10  ← 미래지향성
```

| 등급 | 범위 | 칭호 |
|------|------|------|
| 새싹 | 0 ~ 399 | 🌱 새싹 |
| 성실 | 400 ~ 599 | ⭐ 성실 |
| 갓생 | 600 ~ 849 | 🔥 갓생 |
| 레전드 | 850 ~ 1000 | 👑 레전드 |

### 3. 블록체인 데이터 무결성 파이프라인

미션 완료 데이터를 **Keccak-256 + SHA-256** 이중 해싱 후 온체인 기록합니다.  
클라이언트에서 1차 해시 생성 → 서버에서 교차 검증 → 위변조 감지 시 경고 처리.

```
미션 완료
  → 클라이언트 SHA-256 해시 생성 (위변조 방지 1차)
  → 서버 교차 검증 + AI 생성물 판별
  → Keccak-256(userId + missionId + timestamp + rawData)
  → 온체인 Mock 기록 (tx_hash 반환)
  → Supabase mission_logs INSERT
  → 포인트 지급
```

> **현재 단계**: 실제 블록체인 연동 없이 Mock 파이프라인으로 구현 (`BLOCKCHAIN_MOCK_MODE=true`)

### 4. 금리 우대 혜택 시뮬레이션

- 갓생점수에 따라 **최대 1.5%p 금리 인하** 혜택 계산
- 금리 계산 로직은 서버 전용 (클라이언트 조작 불가, 감사 추적 보장)
- 점수 등급별 우대 티어: 일반 / 우수 / 최우수

---

## 🛠 기술 스택

| 레이어 | 기술 |
|--------|------|
| 모바일 프론트엔드 | React Native (Expo SDK 52) + TypeScript Strict |
| 라우팅 | Expo Router v4 |
| 상태 관리 | Zustand v5 + Immer |
| 스타일링 | NativeWind v4 (Tailwind CSS 3.x) |
| 아키텍처 | Clean Architecture (Domain / Application / Infrastructure / Presentation) |
| 백엔드 | FastAPI 0.115 + Uvicorn (Python 3.13) |
| ML 엔진 | XGBoost 2.1 + SHAP 0.47+ + scikit-learn |
| 소득 예측 | Prophet 1.1.6 |
| 데이터베이스 | PostgreSQL (Supabase) |
| 인증 | Supabase Auth + JWT |
| 해싱/암호화 | crypto-js (클라이언트 Keccak-256) / pycryptodome (서버) |
| HTTP 클라이언트 | axios 1.x |
| 배치/스케줄링 | Celery Beat + Redis |

---

## 📱 구현된 화면 (5개)

| 화면 | 파일 | 주요 기능 |
|------|------|-----------|
| 홈 대시보드 | `HomeScreen.tsx` | 갓생점수·스트릭·코인 헤더, 가상 작업실, Today's Quest 카드 |
| 미션 센터 | `MissionCenterScreen.tsx` | 4탭(A/B/C/D), 진행률 바, 미션 완료 → txHash 표시 |
| 미션 업로드 | `MissionUploadScreen.tsx` | 파일 형식 선택, AI 단계별 진행 애니메이션, 블록체인 결과 |
| 아이템 스토어 | `ItemStoreScreen.tsx` | 작업실 프리뷰, 가로 스크롤 아이템 카드, 코인 구매 |
| 금융 리포트 | `FinanceReportScreen.tsx` | 금리 비교 애니메이션, SHAP Top5, 성장 타임라인, CTA 버튼 |

**네비게이션**: Bottom Tab 5탭 — 홈🏠 / 미션⚡ / 스토어🛒 / 리포트📊 / 내정보👤


```mermaid
---
title: 하나 더 (Hana More) — 전체 시스템 아키텍처
---
flowchart LR
    subtitle["수집 → 검증 → 추론 → 고도화<br>4단계 파이프라인"]

    %% Stage 1: 수집
    subgraph 수집 ["1. 수집 단계 (Data Collection)"]
        direction TB
        RN["React Native SDK<br>(모바일 앱)"] 
        DS["OS 레벨 데이터 수집<br>• 기상: UsageStatsManager, Screen Time API<br>• 수면·운동: Samsung Health, Apple HealthKit<br>• 금융: 마이데이터 표준 API"]
        HASH["Keccak256 해싱<br>즉시 서버 전송"]
        RN --> DS
        DS --> HASH
    end

    HASH --> SERVER["FastAPI 서버"]

    %% Stage 2: 검증
    subgraph 검증 ["2. 검증 단계 (Verification & Anti-Tamper)"]
        direction TB
        ANTI["Anti-Tamper 엔진<br>• GPS 위조 검증<br>• 당일 중복 요청<br>• AI 생성 인증샷 여부"]
        PG["PostgreSQL<br>(데이터 저장)"]
        KAF["Kafka<br>(비동기 큐)"]
        BC["블록체인 온체인 기록<br>(Mock 파이프라인)"]
        ANTI --> PG
        ANTI --> KAF
        KAF --> BC
    end

    SERVER --> ANTI

    %% Stage 3: 추론
    subgraph 추론 ["3. 추론 단계 (Inference & Closed-loop)"]
        direction TB
        GOD["GodScore Engine<br>XGBoost 실시간 인퍼런스"]
        SHAP["SHAP Value 분석<br>(행동별 기여도 정량 설명)"]
        CL["Closed-loop 피드백<br>미션 수행 → 데이터 정제 → 점수 재산출 → 사용자 즉각 피드백"]
        GOD --> SHAP
        SHAP --> CL
    end

    ANTI --> GOD

    %% Stage 4: 고도화
    subgraph 고도화 ["4. 고도화 단계 (Model Advancement)"]
        direction TB
        RETRAIN["분기별 재학습<br>XGBoost 모델"]
        KFOLD["K-Fold 교차 검증<br>피처 통계적 유의성 재검토"]
        LOAN["실제 대출 상환 이력 결합"]
        UPDATE["가중치 자동 재조정<br>살아있는 신용 평가 엔진"]
        RETRAIN --> KFOLD
        KFOLD --> LOAN
        LOAN --> UPDATE
    end

    GOD & PG --> RETRAIN

    %% 최종 출력
    CL --> SCORE["갓생점수<br>(God-Saeng Score)"]
    SCORE --> ALT["하나 대안신용점수<br>(갓생점수 + 기존 CB 신용평가)"]
    ALT -.-> BENEFIT["금리 우대 / 대안 심사"]

    subtitle --> 수집

    style subtitle fill:#0A2540, color:#fff, stroke:#fff, font-size:18px
    style 수집 fill:#E3F2FD, stroke:#1976D2
    style 검증 fill:#E8F5E9, stroke:#388E3C
    style 추론 fill:#FFF3E0, stroke:#F57C00
    style 고도화 fill:#F3E5F5, stroke:#7B1FA2
---

## 🚀 실행 방법 (Getting Started)

### 사전 요구사항

- Node.js 20+
- Python 3.13
- Redis (배치 작업 사용 시)

---

### 📱 프론트엔드 (Mobile App)

```bash
# 의존성 설치
npm install

# 앱 실행 (iOS / Android / Web 선택)
npx expo start
```

> **웹 브라우저 테스트 팁**: 창 너비를 **390px ~ 480px** 로 좁혀 모바일 UI로 확인하세요.

**유용한 npm 스크립트**

```bash
npm run type-check  # TypeScript 타입 오류 검사 (tsc --noEmit)
npm run lint        # ESLint 정적 분석
npm run android     # Android 에뮬레이터 직접 실행
npm run ios         # iOS 시뮬레이터 직접 실행
```

---

### ⚙️ 백엔드 (API Server)

```bash
cd backend

# 가상환경 구축 및 의존성 설치
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env 파일을 열어 SUPABASE_URL, SUPABASE_ANON_KEY, JWT_SECRET 등을 실제 값으로 교체

# 서버 실행
python -m app.main
# 또는: uvicorn app.main:app --reload --port 8000
```

서버가 정상 실행되면 다음 주소에서 Swagger 문서를 확인할 수 있습니다.

```
http://localhost:8000/docs
```

**데모 환경에서는 `.env`의 Mock 플래그를 켜두면 Supabase·블록체인 없이도 실행됩니다.**

```env
BLOCKCHAIN_MOCK_MODE=true
GPT_API_MOCK_MODE=true
```

---

### 🗄️ 환경변수 요약 (`.env.example` 기준)

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase 공개 API 키 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 Service Role 키 | ✅ |
| `JWT_SECRET` | Supabase JWT Secret | ✅ |
| `REDIS_URL` | Redis 연결 URL (Celery용) | 배치 작업 시 |
| `BLOCKCHAIN_MOCK_MODE` | `true` = Mock 파이프라인 사용 | 기본 `true` |
| `GPT_API_MOCK_MODE` | `true` = AI 검증 Mock 사용 | 기본 `true` |

---

## 🌐 API 엔드포인트

### 갓생스코어 (`/api/v1/godscore`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/calculate` | 피처 벡터 → XGBoost+SHAP 점수 산출 및 Supabase 저장 |
| `GET` | `/latest` | 최신 갓생점수 조회 |
| `GET` | `/history` | 점수 이력 조회 |
| `GET` | `/leaderboard` | 전체 랭킹 조회 |
| `GET` | `/weights` | 현재 카테고리 내 미션별 가중치 조회 |

### 미션 (`/api/v1/missions`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/complete` | 미션 완료 처리 (해싱 → AI 검증 → 블록체인 기록) |

### 금융 혜택 (`/api/v1/finance`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/rate-benefit` | 갓생점수 기반 금리 우대 혜택 계산 |

> 금리 계산 로직은 **서버 전용**으로 설계되어, 클라이언트 조작이 불가능하고 변경 시 앱 업데이트 없이 서버만 수정하면 됩니다.

---

## 📁 폴더 구조 (Project Structure)

```
hana-more/
├── app/                        # Expo Router 진입점 & 레이아웃
│   ├── index.tsx
│   └── _layout.tsx
├── assets/
│   ├── fonts/                  # Hana2 폰트 + Paperlogy 폰트
│   └── images/                 # 앱 내 이미지 리소스
├── src/                        # 클린 아키텍처 핵심 로직
│   ├── domain/                 # 엔티티 & 유즈케이스 (비즈니스 룰)
│   │   ├── entities/           # User, Mission, GodScore
│   │   ├── usecases/           # CalculateGodScore, CompleteMission
│   │   └── repositories/       # IMissionRepository (인터페이스)
│   ├── application/            # 상태 관리 & 비즈니스 오케스트레이션
│   │   ├── stores/             # godScoreStore, missionStore, authStore
│   │   └── hooks/              # useGodScore, useMLEngine
│   ├── infrastructure/         # 외부 시스템 어댑터
│   │   ├── supabase/           # MissionRepositoryImpl, missionPipeline
│   │   ├── blockchain/         # keccak256 해싱 (crypto-js)
│   │   └── api/                # apiClient (axios 래퍼)
│   ├── presentation/           # 화면 및 네비게이션
│   │   ├── screens/            # 5개 화면 컴포넌트
│   │   └── navigation/         # AppNavigator (Bottom Tab)
│   └── constants/
│       └── mockData.ts         # 개발용 더미 데이터
├── types/                      # 글로벌 TypeScript 타입 정의
│   ├── features.ts             # 4가지 행동 피처 타입 (A/B/C/D)
│   ├── mission.ts              # 미션 관련 타입 & 상태
│   ├── godScore.ts             # 갓생점수 타입
│   └── blockchain.ts           # 블록체인 무결성 타입
├── backend/                    # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py             # 앱 진입점 (CORS, 라우터, lifespan)
│   │   ├── routers/            # godscore, missions, finance
│   │   ├── services/           # GodScoreEngine, MockBlockchain, KeccakHasher, MockAIValidator
│   │   ├── schemas/            # Pydantic 요청/응답 스키마
│   │   ├── core/               # config, security(JWT), supabase_client
│   │   └── middleware/         # RateLimitMiddleware
│   ├── supabase/migrations/    # DB 초기 스키마 SQL
│   └── scripts/init_model.py   # XGBoost 초기 모델 생성 스크립트
├── jobs/ml/                    # 분기별 XGBoost 재학습 배치
│   ├── retrain.py
│   ├── synthetic_data.py
│   └── schedule.py
├── tailwind.config.js          # 하나 브랜드 컬러 팔레트
├── babel.config.js
├── metro.config.js
└── tsconfig.json               # TypeScript Strict 설정
```

---

## 💡 데모 시나리오 (권장 흐름)

1. **미션 센터** — 생활 루틴이나 업무 인증 미션을 완료해 포인트 획득
2. **갓생점수 확인** — 홈 화면에서 실시간으로 반영되는 갓생점수 확인
3. **금융 리포트** — SHAP 분석으로 점수 변화 요인 파악, 하나은행 금리 우대 혜택 시뮬레이션
4. **스토어** — 획득한 코인으로 나만의 작업실 아이템 구매

---

## ⚠️ 데모 제약 사항

- **블록체인**: 실제 스마트 컨트랙트 미연동 → Mock 파이프라인 (`BLOCKCHAIN_MOCK_MODE=true`)
- **Supabase**: Mock 파이프라인 모드에서는 DB 미연결로도 동작
- **마이데이터 API**: 미연동 (실제 금융 데이터 대신 더미 데이터 사용)
- **AI 검증**: OpenAI API 미연동 → Mock 판별기 사용 (`GPT_API_MOCK_MODE=true`)

---

## 👥 팀 짱사이트

| 이름 | 역할 |
|------|------|
| 구준모 | 팀장 / 기획 |
| 권유철 | 프론트엔드 / 아키텍처 |
| 조대흠 | 백엔드 / ML |
| 한민영 | 디자인 / UI |

---

**하나 청년 금융인재 양성 프로젝트 2026 출품작**
