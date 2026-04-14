"""
app/middleware/rate_limit.py
간단한 IP 기반 Rate Limiting 미들웨어.

외부 라이브러리(slowapi 등) 없이 인메모리 카운터로 구현.
실서비스: Redis 기반 분산 카운터로 교체 필요.

제한 정책 (데모 기준):
  - 일반 엔드포인트: 분당 60회
  - /calculate (추론 비용 높음): 분당 10회
  - /retrain (분기 1회 전용): 시간당 2회
"""
import time
import logging
from collections import defaultdict, deque
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ── 엔드포인트별 제한 정책 ─────────────────────────────
# (path_prefix, max_requests, window_seconds)
RATE_POLICIES: list[tuple[str, int, int]] = [
    ("/api/v1/godscore/calculate", 10,  60),   # 추론 비용 높음: 분당 10회
    ("/api/v1/godscore/retrain",    2, 3600),  # 분기 전용: 시간당 2회
    ("/api/v1/",                   60,  60),   # 기타 API: 분당 60회
]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    IP 기반 슬라이딩 윈도우 Rate Limiter.

    각 (IP, path_prefix) 쌍에 대해 deque 로 타임스탬프를 추적합니다.
    window_seconds 보다 오래된 요청은 제거 후 카운트합니다.
    """

    def __init__(self, app):
        super().__init__(app)
        # 요청 타임스탬프 저장: {(ip, path_prefix): deque[timestamp]}
        self._windows: dict[tuple[str, str], deque] = defaultdict(deque)

    def _get_client_ip(self, request: Request) -> str:
        """X-Forwarded-For 헤더 우선, 없으면 직접 연결 IP"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _find_policy(self, path: str) -> tuple[str, int, int] | None:
        """요청 경로에 해당하는 제한 정책 반환 (가장 구체적인 것 우선)"""
        for prefix, max_req, window in RATE_POLICIES:
            if path.startswith(prefix):
                return prefix, max_req, window
        return None

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        policy = self._find_policy(request.url.path)
        if policy is None:
            return await call_next(request)

        prefix, max_requests, window_secs = policy
        ip = self._get_client_ip(request)
        key = (ip, prefix)
        now = time.monotonic()

        window = self._windows[key]
        # 만료된 타임스탬프 제거
        while window and now - window[0] > window_secs:
            window.popleft()

        if len(window) >= max_requests:
            retry_after = int(window_secs - (now - window[0])) + 1
            logger.warning(f"Rate limit 초과: ip={ip}, path={request.url.path}")
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"요청 횟수를 초과했습니다. {retry_after}초 후 다시 시도하세요.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        window.append(now)
        return await call_next(request)
