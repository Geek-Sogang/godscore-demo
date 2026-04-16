# 하나 더 (Hana More) — 갓생스코어 앱 데모 🌱

**"소득 증빙이 어려운 긱워커를 위한 블록체인 기반 대안신용평가 플랫폼"**

> 본 프로젝트는 하나은행 공모전 출품작의 프론트엔드/도메인 로직 프로토타입(Demo Ver.1)입니다.

---

## 🎯 프로젝트 개요

**하나 더 (Hana More)**는 프리랜서·긱워커 등 정규 소득 증빙이 어려워 기존 금융권 신용평가에서 소외된 계층을 위한 **대안신용평가 플랫폼**입니다.  
사용자의 일상 활동과 금융 패턴을 4가지 핵심 행동 피처(Feature)로 수집하고, 머신러닝 가중치 기반으로 **갓생점수(God-Saeng Score)**를 산출합니다.

---

## ✨ 주요 기능

### 1. 4가지 행동 피처 수집
- **Type A (생활 루틴):** 기상 시간, 수면 규칙성, 앱 출석, 미션 달성률
- **Type B (일·소득):** 포트폴리오 업로드, 소득 변동성, 업무 완료 인증
- **Type C (소비 행동):** 소비 패턴 규칙성, 새벽 충동 결제, 잔고 유지 여부
- **Type D (개인 ESG):** 대중교통 이용, 에너지 절약, 운동/기부 활동

### 2. 실시간 갓생점수 산출 (ML Mock 엔진)
- XGBoost 구조를 차용한 가중치 기반 계산식 (분기별 재학습 구조)
- SHAP Value 개념 도입 — 어떤 행동이 점수에 영향을 줬는지 투명하게 제공

### 3. 블록체인 데이터 무결성 파이프라인
- 미션 완료 데이터를  해시 후 온체인 기록 (현재: Mock 파이프라인)
- SHA-256 클라이언트 해시로 위변조 감지

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
| 블록체인 | Keccak256 + SHA-256 (Mock 모드) |
| 배치 | Celery Beat + Redis |

---

## 🚀 실행 방법 (Getting Started)

### 사전 준비
- Node.js 18 이상
- Python 3.11 ~ 3.13 (3.14는 pydantic-core 빌드 오류 발생 — 아래 Known Issues 참고)
- npm 또는 yarn

---

### 📱 프론트엔드 실행



> **팁:** 웹 브라우저에서 테스트 시 창 너비를 390px~480px 로 좁혀서 모바일 UI로 확인하세요.

---

### ⚙️ 백엔드 실행



백엔드가 정상 실행되면 터미널에 아래 메시지가 표시됩니다:


>  경고가 나와도 서버는 정상 동작합니다.  
> 를 먼저 실행하면 경고가 사라집니다.

---

### 🔑 환경변수 설정

프로젝트 루트()에  파일이 있는지 확인하세요:

SHELL=/bin/bash
COREPACK_ENABLE_AUTO_PIN=0
CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001
CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1
CLAUDE_CODE_ACCOUNT_UUID=950d8e9e-e01d-48cb-9bff-073129235a55
CLAUDE_CODE_EMIT_TOOL_USE_SUMMARIES=
CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL=true
no_proxy=localhost,127.0.0.1,::1,*.local,.local,169.254.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
CLAUDE_CODE_USER_EMAIL=jodaeheum800@gmail.com
CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1
GIT_SSH_COMMAND=ssh -o ProxyCommand='socat - PROXY:localhost:%h:%p,proxyport=3128'
ANTHROPIC_API_KEY=
CLAUDE_COWORK_MEMORY_PATH_OVERRIDE=/sessions/eager-dreamy-faraday/mnt/.auto-memory
grpc_proxy=socks5h://localhost:1080
CLAUDE_CODE_HOST_SOCKS_PROXY_PORT=41023
CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST=1
PWD=/sessions/eager-dreamy-faraday
LOGNAME=eager-dreamy-faraday
SYSTEMD_EXEC_PID=735
CLAUDE_CODE_HOST_PLATFORM=darwin
NoDefaultCurrentDirectoryInExePath=1
TZ=Asia/Seoul
ftp_proxy=socks5h://localhost:1080
CLAUDECODE=1
HOME=/sessions/eager-dreamy-faraday
CLOUDSDK_PROXY_TYPE=https
LANG=C.UTF-8
CLOUDSDK_PROXY_PORT=3128
CLAUDE_COWORK_MEMORY_EXTRA_GUIDELINES=## Sensitive personal information

Do not save the following to memory unless the user explicitly asks you to remember it:

- Protected attributes: race, ethnicity, national origin, religion, age, sex, sexual orientation, gender identity, immigration status, disability, serious illness, union membership
- Government identifiers: Social Security numbers, driver's license numbers, passport numbers, government ID numbers
- Financial account details: credit card numbers, bank account numbers
- Health information: medical conditions, diagnoses, lab results, mental health details, therapy or counseling
- Home or personal mailing addresses (work addresses are fine)
- Account passwords, secret tokens, or secret keys

If any of the above appears in conversation context, complete the task but do not persist it to a memory file. If the user explicitly says "remember my address is X", saving it is acceptable — they've given consent.
CLAUDE_CODE_DISABLE_CRON=1
CLAUDE_CONFIG_DIR=/sessions/eager-dreamy-faraday/mnt/.claude
CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING=1
DOCKER_HTTP_PROXY=http://localhost:3128
TMPDIR=/sessions/eager-dreamy-faraday/tmp
https_proxy=http://localhost:3128
INVOCATION_ID=fd8d226914724396acaa54ef516a0f45
ANTHROPIC_BASE_URL=https://api.anthropic.com
CLAUDE_CODE_ACCOUNT_TAGGED_ID=user_01KQXktiR4Jei74qWcBVmR4g
CLAUDE_TMPDIR=/sessions/eager-dreamy-faraday/tmp
CLAUDE_CODE_TAGS=lam_session_type:chat
MCP_TOOL_TIMEOUT=60000
USER=eager-dreamy-faraday
NO_PROXY=localhost,127.0.0.1,::1,*.local,.local,169.254.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
FTP_PROXY=socks5h://localhost:1080
CLAUDE_CODE_TMPDIR=/sessions/eager-dreamy-faraday/tmp
RSYNC_PROXY=localhost:1080
SHLVL=2
GIT_EDITOR=true
HTTPS_PROXY=http://localhost:3128
HTTP_PROXY=http://localhost:3128
http_proxy=http://localhost:3128
USE_LOCAL_OAUTH=
GRPC_PROXY=socks5h://localhost:1080
OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta
DISABLE_AUTOUPDATER=1
CLAUDE_CODE_WORKSPACE_HOST_PATHS=/Users/damisoda/Desktop/서강대학교/INSIGHT/하나은행 공모전/하나공모전|/Users/damisoda/Desktop/서강대학교/INSIGHT/하나은행 공모전|/Users/damisoda/Desktop/서강대학교/INSIGHT/하나은행 공모전/하나_demo_ver1
CLAUDE_CODE_ENTRYPOINT=local-agent
ALL_PROXY=socks5h://localhost:1080
ENABLE_TOOL_SEARCH=auto
API_TIMEOUT_MS=900000
MCP_CONNECTION_NONBLOCKING=true
CLAUDE_CODE_OAUTH_TOKEN=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
JOURNAL_STREAM=8:8798
CLAUDE_CODE_EXECPATH=/usr/local/bin/claude
all_proxy=socks5h://localhost:1080
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:/sessions/eager-dreamy-faraday/mnt/.remote-plugins/plugin_018pLNd4CGF8vEEmyztWR7fi/bin:/sessions/eager-dreamy-faraday/mnt/.remote-plugins/plugin_01GC5sHmfRpUwySPemYHW7n5/bin
SANDBOX_RUNTIME=1
CLOUDSDK_PROXY_ADDRESS=localhost
CLAUDE_CODE_ORGANIZATION_UUID=8c8edf7f-952e-4620-958d-0a0742d6d341
CLAUDE_CODE_HOST_HTTP_PROXY_PORT=43005
DISABLE_MICROCOMPACT=1
DOCKER_HTTPS_PROXY=http://localhost:3128
CLAUDE_CODE_IS_COWORK=1
USE_STAGING_OAUTH=
_=/usr/bin/env

백엔드()에도  파일이 필요합니다:

SHELL=/bin/bash
COREPACK_ENABLE_AUTO_PIN=0
CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001
CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1
CLAUDE_CODE_ACCOUNT_UUID=950d8e9e-e01d-48cb-9bff-073129235a55
CLAUDE_CODE_EMIT_TOOL_USE_SUMMARIES=
CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL=true
no_proxy=localhost,127.0.0.1,::1,*.local,.local,169.254.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
CLAUDE_CODE_USER_EMAIL=jodaeheum800@gmail.com
CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1
GIT_SSH_COMMAND=ssh -o ProxyCommand='socat - PROXY:localhost:%h:%p,proxyport=3128'
ANTHROPIC_API_KEY=
CLAUDE_COWORK_MEMORY_PATH_OVERRIDE=/sessions/eager-dreamy-faraday/mnt/.auto-memory
grpc_proxy=socks5h://localhost:1080
CLAUDE_CODE_HOST_SOCKS_PROXY_PORT=41023
CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST=1
PWD=/sessions/eager-dreamy-faraday
LOGNAME=eager-dreamy-faraday
SYSTEMD_EXEC_PID=735
CLAUDE_CODE_HOST_PLATFORM=darwin
NoDefaultCurrentDirectoryInExePath=1
TZ=Asia/Seoul
ftp_proxy=socks5h://localhost:1080
CLAUDECODE=1
HOME=/sessions/eager-dreamy-faraday
CLOUDSDK_PROXY_TYPE=https
LANG=C.UTF-8
CLOUDSDK_PROXY_PORT=3128
CLAUDE_COWORK_MEMORY_EXTRA_GUIDELINES=## Sensitive personal information

Do not save the following to memory unless the user explicitly asks you to remember it:

- Protected attributes: race, ethnicity, national origin, religion, age, sex, sexual orientation, gender identity, immigration status, disability, serious illness, union membership
- Government identifiers: Social Security numbers, driver's license numbers, passport numbers, government ID numbers
- Financial account details: credit card numbers, bank account numbers
- Health information: medical conditions, diagnoses, lab results, mental health details, therapy or counseling
- Home or personal mailing addresses (work addresses are fine)
- Account passwords, secret tokens, or secret keys

If any of the above appears in conversation context, complete the task but do not persist it to a memory file. If the user explicitly says "remember my address is X", saving it is acceptable — they've given consent.
CLAUDE_CODE_DISABLE_CRON=1
CLAUDE_CONFIG_DIR=/sessions/eager-dreamy-faraday/mnt/.claude
CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING=1
DOCKER_HTTP_PROXY=http://localhost:3128
TMPDIR=/sessions/eager-dreamy-faraday/tmp
https_proxy=http://localhost:3128
INVOCATION_ID=fd8d226914724396acaa54ef516a0f45
ANTHROPIC_BASE_URL=https://api.anthropic.com
CLAUDE_CODE_ACCOUNT_TAGGED_ID=user_01KQXktiR4Jei74qWcBVmR4g
CLAUDE_TMPDIR=/sessions/eager-dreamy-faraday/tmp
CLAUDE_CODE_TAGS=lam_session_type:chat
MCP_TOOL_TIMEOUT=60000
USER=eager-dreamy-faraday
NO_PROXY=localhost,127.0.0.1,::1,*.local,.local,169.254.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
FTP_PROXY=socks5h://localhost:1080
CLAUDE_CODE_TMPDIR=/sessions/eager-dreamy-faraday/tmp
RSYNC_PROXY=localhost:1080
SHLVL=2
GIT_EDITOR=true
HTTPS_PROXY=http://localhost:3128
HTTP_PROXY=http://localhost:3128
http_proxy=http://localhost:3128
USE_LOCAL_OAUTH=
GRPC_PROXY=socks5h://localhost:1080
OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta
DISABLE_AUTOUPDATER=1
CLAUDE_CODE_WORKSPACE_HOST_PATHS=/Users/damisoda/Desktop/서강대학교/INSIGHT/하나은행 공모전/하나공모전|/Users/damisoda/Desktop/서강대학교/INSIGHT/하나은행 공모전|/Users/damisoda/Desktop/서강대학교/INSIGHT/하나은행 공모전/하나_demo_ver1
CLAUDE_CODE_ENTRYPOINT=local-agent
ALL_PROXY=socks5h://localhost:1080
ENABLE_TOOL_SEARCH=auto
API_TIMEOUT_MS=900000
MCP_CONNECTION_NONBLOCKING=true
CLAUDE_CODE_OAUTH_TOKEN=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
JOURNAL_STREAM=8:8798
CLAUDE_CODE_EXECPATH=/usr/local/bin/claude
all_proxy=socks5h://localhost:1080
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:/sessions/eager-dreamy-faraday/mnt/.remote-plugins/plugin_018pLNd4CGF8vEEmyztWR7fi/bin:/sessions/eager-dreamy-faraday/mnt/.remote-plugins/plugin_01GC5sHmfRpUwySPemYHW7n5/bin
SANDBOX_RUNTIME=1
CLOUDSDK_PROXY_ADDRESS=localhost
CLAUDE_CODE_ORGANIZATION_UUID=8c8edf7f-952e-4620-958d-0a0742d6d341
CLAUDE_CODE_HOST_HTTP_PROXY_PORT=43005
DISABLE_MICROCOMPACT=1
DOCKER_HTTPS_PROXY=http://localhost:3128
CLAUDE_CODE_IS_COWORK=1
USE_STAGING_OAUTH=
_=/usr/bin/env

---

## 🔍 개발자 도구 — Mock DB 확인

앱이 웹 브라우저에서 실행 중일 때, 크롬 개발자 도구 콘솔에서 Mock DB 상태를 직접 조회할 수 있습니다:



미션 완료 시 콘솔에 아래와 같이 구조화된 로그가 출력됩니다:


---

## 💡 데모 시나리오

1. 앱 실행 후 **미션 센터** 탭 진입
2. A/B/C/D 탭에서 미션 선택 → **완료** 버튼 클릭
3. 홈 화면에서 갓생점수 변화 확인
4. **금융 리포트** 탭에서 SHAP 분석 결과 및 금리 인하 현황 확인
5. **스토어** 탭에서 코인으로 작업실 아이템 구매

---

## ⚠️ Known Issues

| 문제 | 원인 | 해결 방법 |
|------|------|-----------|
|  빌드 실패 | Python 3.14 — PyO3 0.22.6 미지원 | Python 3.11 ~ 3.13 사용 |
|  TypeError (numpy) | shap 0.46 + NumPy 2.x + Python 3.13 |  |
|  경로 오류 | 루트에서 실행 시  | **반드시  후 실행** |
| XGBoost fallback mode 경고 |  모델 파일 없음 |  실행 |

---

## 📁 폴더 구조



---

## 👥 팀 짱사이트

| 이름 | 역할 |
|------|------|
| 구준모 | 팀장 |
| 권유철 | 개발 |
| 조대흠 | 개발 |
| 한민영 | 개발 |

> 하나 청년 금융인재 양성 프로젝트 2026 출품작
