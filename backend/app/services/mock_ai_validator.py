"""
app/services/mock_ai_validator.py
GPT API Mock - AI 생성 콘텐츠 판별 서비스 (규칙 기반).
실제 운영 시 OpenAI GPT API 호출로 교체.
"""
import hashlib
import logging

logger = logging.getLogger(__name__)

# 중복 제출 방지용 문서 해시 세트 (운영 시 Redis로 교체)
_submitted_hashes: set[str] = set()


def check_ai_generated(mission_code: str, raw_data: dict) -> dict:
    """
    AI 생성 여부 판별 (Mock 규칙 기반).
    Returns: {is_ai_generated: bool, confidence: float, reason: str}
    """
    file_name: str = raw_data.get("file_name", "").lower()
    file_size: int = raw_data.get("file_size_bytes", 999999)

    # 규칙 1: 파일명 AI 패턴 감지
    ai_prefixes = ("ai_", "generated_", "gpt_", "chatgpt", "claude_", "dalle_")
    if any(file_name.startswith(p) for p in ai_prefixes):
        logger.warning(f"AI 생성 의심 (파일명): {file_name}")
        return {"is_ai_generated": True, "confidence": 0.92, "reason": f"파일명에 AI 생성 패턴 감지: '{file_name}'"}

    # 규칙 2: 비정상 파일 크기
    if 0 < file_size < 1024:
        return {"is_ai_generated": True, "confidence": 0.75, "reason": f"파일 크기 비정상 ({file_size} bytes)"}

    # 규칙 3: D4 문서 해시 중복 제출
    if mission_code == "D4":
        doc_hash = raw_data.get("document_hash", "")
        if doc_hash:
            if doc_hash in _submitted_hashes:
                return {"is_ai_generated": True, "confidence": 1.0, "reason": "이미 제출된 문서입니다."}
            _submitted_hashes.add(doc_hash)

    # 규칙 4: 허용 파일 형식 검사
    allowed = {"B1": {"pdf","mp4","png","jpg","jpeg","zip"}, "B4": {"png","jpg","jpeg","pdf","mp4"},
               "D3": {"png","jpg","jpeg","pdf"}, "D4": {"pdf","jpg","jpeg","png"}}.get(mission_code, set())
    if allowed and file_name and "." in file_name:
        ext = file_name.rsplit(".", 1)[-1]
        if ext not in allowed:
            return {"is_ai_generated": True, "confidence": 0.85, "reason": f"허용되지 않는 파일 형식: .{ext}"}

    return {"is_ai_generated": False, "confidence": 0.88, "reason": "인간 작성 콘텐츠로 판별됨 (Mock 규칙 기반)"}


def compute_document_hash(file_content_bytes: bytes) -> str:
    """업로드 파일 SHA-256 해시 (D4 중복 제출 방지)"""
    return hashlib.sha256(file_content_bytes).hexdigest()
