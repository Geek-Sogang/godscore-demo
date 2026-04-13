# CLAUDE.md — 하나 더 (Hana More) 개발 규칙 및 명세서

## 프로젝트 개요
- **앱명**: 하나 더 (Hana More)
- **팀**: 짱사이트 (서강대학교)
- **팀원**: 구준모(팀장) · 권유철 · 조대흠 · 한민영
- **공모전**: 하나 청년 금융인재 양성 프로젝트 2026
- **기술 스택**: React Native (Expo SDK 52) + TypeScript (Strict) + Zustand + Supabase

---

## 아키텍처 원칙 (Clean Architecture)

```
Presentation  →  Application  →  Domain  ←  Infrastructure
(screens)        (stores/hooks)   (entities/usecases)  (blockchain/supabase)
```

### 의존성 방향 규칙
- `Presentation` 은 `Application` 만 참조 (직접 Domain/Infra 참조 금지)
- `Application` 은 `Domain` 만 참조
- `Infrastructure` 는 `Domain` 인터페이스를 구현
- 순환 참조 절대 금지

---

## 폴더 구조

```
hana-more/
├── app/                          # Expo Router 진입점
│   └── index.tsx
├── src/
│   ├── domain/                   # 핵심 비즈니스 규칙
│   │   ├── entities/             # User, Mission, GodScore 엔티티
│   │   └── usecases/             # CalculateGodScore, CompleteMission
│   ├── infrastructure/           # 외부 시스템 어댑터
│   │   ├── blockchain/           # keccak256 해싱 (crypto-js)
│   │   └── supabase/             # Mock DB 파이프라인
│   ├── application/              # 상태 관리 & 비즈니스 오케스트레이션
│   │   ├── stores/               # Zustand stores
│   │   └── hooks/                # useMLEngine, useGodScore
│   └── presentation/             # 화면 (Skeleton UI)
│       ├── screens/
│       └── navigation/
└── types/                        # 공유 TypeScript 인터페이스
    ├── features.ts               # 4가지 행동 피처 타입 (A/B/C/D)
    ├── mission.ts                # 미션 관련 타입
    ├── godScore.ts               # 갓생점수 관련 타입
    └── blockchain.ts             # 블록체인 무결성 타입
```

---

## 코딩 규칙

### TypeScript
- **Strict Mode 필수**: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- `any` 타입 사용 금지 → `unknown` 으로 대체 후 타입 가드 적용
- 모든 함수 반환 타입 명시
- `interface` vs `type`: 확장 가능한 구조는 `interface`, 유니온/인터섹션은 `type`

### 컴포넌트 규칙
- 모든 화면 컴포넌트 최상단에 `// Figma 매칭: [화면명]` 주석 필수
- Props는 반드시 명시적 interface로 정의
- 현재 단계(뼈대)에서는 스타일링 없이 `View`, `Text`, `Button`, `ScrollView` 만 사용
- NativeWind, StyleSheet 적용은 Figma 디자인 확정 후 진행

### 상태 관리 (Zustand)
- Store 파일명: `[도메인]Store.ts` (예: `godScoreStore.ts`)
- Store 내 side effect는 action 함수 안에서만 처리
- `immer` 미들웨어로 불변성 관리

### 파일 네이밍
- 컴포넌트: `PascalCase.tsx`
- 유틸/훅/스토어: `camelCase.ts`
- 타입 파일: `camelCase.ts` (types/ 폴더)
- 상수: `UPPER_SNAKE_CASE`

### Import 순서
1. React/React Native 기본 모듈
2. 외부 라이브러리 (expo, zustand 등)
3. 내부 모듈 (@domain, @app, @infra, @presentation)
4. types
5. 상대 경로 (./)

---

## 갓생점수(S) 알고리즘 명세

### 피처별 점수 산출
```
fA = wA1·A1 + wA2·A2 + wA3·A3 + wA4·A4  // 생활 루틴
fB = wB1·B1 + wB2·B2 + wB3·B3 + wB4·B4  // 일·소득
fC = wC1·C1 + wC2·C2 + wC3·C3 + wC4·C4  // 소비 행동
fD = wD1·D1 + wD2·D2 + wD3·D3 + wD4·D4  // 개인 ESG
```

### 최종 점수
```
S = wA·fA + wB·fB + wC·fC + wD·fD
```

### 초기 가중치 (행동경제학 기반 가설값, 분기별 XGBoost 재조정)
| 카테고리 | 초기 wX | 근거 |
|---------|---------|------|
| wA (생활 루틴) | 0.30 | 자기통제력 — 기상/수면 규칙성 |
| wB (일·소득) | 0.35 | 상환 능력 — 소득 지속성 |
| wC (소비 행동) | 0.25 | 충동성 — 소비 패턴 |
| wD (ESG) | 0.10 | 미래지향성 — ESG 행동 |

### 갱신 주기
- **일별**: Celery Beat KST 00:05, 최근 90일 이동평균 기반
- **분기별**: XGBoost 재학습 → wA~wD 자동 재조정
- **반영 비율**: 분기 점수 70% + 누적 이력 30%

### 점수 등급
| 등급 | 범위 | 칭호 |
|------|------|------|
| 새싹 | 0 ~ 399 | 🌱 새싹 |
| 성실 | 400 ~ 599 | ⭐ 성실 |
| 갓생 | 600 ~ 849 | 🔥 갓생 |
| 레전드 | 850 ~ 1000 | 👑 레전드 |

---

## 블록체인 무결성 파이프라인

```
미션 완료
  → Kafka 이벤트 발행
  → keccak256(userId + missionId + timestamp + rawData) 해시 생성
  → 스마트 컨트랙트 온체인 기록 (tx_hash 반환)
  → blockchain_records INSERT (내부 DB 이중 저장)
  → 검증 시: keccak256 재계산 → 온체인 해시 비교 → verified: true/false
```

### React Native 환경 주의사항
- Node.js `crypto` 모듈 사용 불가 → `crypto-js` (Keccak 함수) 사용
- `ethers.js` v6 사용 시 React Native용 polyfill 필요 (`react-native-get-random-values`)
- 현재 단계: 실제 블록체인 연동 없이 **Mock 파이프라인**으로 구현

---

## 미션 타입 정의 규칙

### 미션 ID 체계
- 형식: `{TYPE_PREFIX}_{INDEX}` (예: `A_1`, `B_2`, `C_3`, `D_4`)
- TYPE_PREFIX: A(생활루틴), B(일소득), C(소비행동), D(ESG)

### 미션 상태
- `PENDING`: 미수행
- `IN_PROGRESS`: 수행 중
- `COMPLETED`: 완료 (블록체인 기록 대기)
- `VERIFIED`: 온체인 기록 완료
- `FAILED`: 검증 실패

---

## 개발 단계 로드맵

| 단계 | 내용 | 상태 |
|------|------|------|
| 1단계 | 파일 분석 | ✅ 완료 |
| 2단계 | 아키텍처 + 환경 설정 + 타입 정의 | ✅ 완료 |
| 3단계 | Zustand Store + ML Engine + Blockchain Mock | ✅ 완료 |
| 4단계 | Skeleton 화면 (데이터 바인딩 테스트) | 🔄 진행 중 |

---

## 금지 사항

### 4단계 (Skeleton) 유지 사항
- ❌ NativeWind 클래스 / StyleSheet 객체 정의 — Figma 확정 전 스타일링 금지
- ❌ Figma 디자인 요소 선반영 (색상, 아이콘, 레이아웃 구체화)
- ❌ 실제 Supabase / 블록체인 연동 (Mock 파이프라인 유지)
- ❌ 실제 마이데이터 API 연동
- ❌ `any` 타입 사용

### 전 단계 공통
- ❌ 순환 참조 (Presentation → Infrastructure 직접 접근)
- ❌ Store 외부에서 직접 상태 뮤테이션
- ❌ 컴포넌트 내 비즈니스 로직 작성 (Hook/Store 위임 원칙)
