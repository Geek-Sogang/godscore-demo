/**
 * src/infrastructure/blockchain/keccak256.ts
 * keccak256 해시 모듈 (React Native 호환)
 *
 * [수정] Deterministic 직렬화 추가
 *   JSON.stringify()는 JS 엔진/기기에 따라 객체 키 순서가 달라
 *   동일 데이터임에도 해시값이 달라지는 치명적 버그 수정.
 *   → deterministicStringify(): 키를 알파벳순 재귀 정렬 후 직렬화
 *   → fast-json-stable-stringify 동일 동작을 외부 의존성 없이 구현
 */
import CryptoJS from 'crypto-js';
import type { HashInput, VerificationResult } from '../../../types/blockchain';

// ── Deterministic 직렬화 (키 알파벳순 정렬, 재귀) ───────────────────
/**
 * 객체/배열/원시값을 키 순서가 보장된 JSON 문자열로 변환
 * 모든 JS 엔진·기기에서 동일한 결과를 보장
 *
 * 예시:
 *   { z: 1, a: 2 } → '{"a":2,"z":1}'  (알파벳 정렬)
 *   { z: 1, a: 2 } → 동일 해시 (항상)
 */
export function deterministicStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(deterministicStringify).join(',') + ']';
  }
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(key => {
      const v = (value as Record<string, unknown>)[key];
      return JSON.stringify(key) + ':' + deterministicStringify(v);
    });
  return '{' + sorted.join(',') + '}';
}

// ── 해시 함수들 ──────────────────────────────────────────────────────

/**
 * keccak256 해시 계산
 * crypto-js SHA3(outputLength: 256) = keccak256
 */
export function computeKeccak256(data: string): string {
  return CryptoJS.SHA3(data, { outputLength: 256 }).toString(CryptoJS.enc.Hex);
}

/**
 * HashInput → Deterministic 직렬화 → keccak256
 * [수정] JSON.stringify → deterministicStringify 교체
 */
export function hashMissionInput(input: HashInput): string {
  // 필드 순서 명시적 고정 + deterministicStringify로 이중 보장
  const normalized = {
    missionId: input.missionId,
    rawDataSerialized: deterministicStringify(
      tryParseJSON(input.rawDataSerialized) ?? input.rawDataSerialized,
    ),
    userId: input.userId,
    utcTimestamp: input.utcTimestamp,
  };
  return computeKeccak256(deterministicStringify(normalized));
}

/**
 * SHA-256 해시 (Anti-Tamper: 클라이언트 → 서버 전송 시 원시 데이터 검증)
 * [수정] rawData가 JSON 문자열일 경우 파싱 후 deterministicStringify 적용
 */
export function computeSHA256(data: string): string {
  const normalized = deterministicStringify(
    tryParseJSON(data) ?? data,
  );
  return CryptoJS.SHA256(normalized).toString(CryptoJS.enc.Hex);
}

/**
 * 데이터 무결성 검증
 * blockchain_records의 온체인 해시 vs 로컬 재계산 해시 비교
 */
export function verifyIntegrity(
  missionLogId: string,
  originalInput: HashInput,
  onChainHash: string,
): VerificationResult {
  const recomputedHash = hashMissionInput(originalInput);
  const verified = recomputedHash === onChainHash;
  return {
    missionLogId,
    recomputedHash,
    onChainHash,
    verified,
    verifiedAt: new Date().toISOString(),
    mismatchReason: verified
      ? null
      : `해시 불일치: 로컬(${recomputedHash.slice(0, 8)}...) ≠ 온체인(${onChainHash.slice(0, 8)}...)`,
  };
}

/**
 * Mock 트랜잭션 해시 생성 (블록체인 연동 전 테스트용)
 */
export function generateMockTxHash(missionLogId: string): string {
  const mockData = deterministicStringify({ id: missionLogId, ts: Date.now(), type: 'mock_tx' });
  return '0x' + computeKeccak256(mockData);
}

// ── 내부 유틸 ─────────────────────────────────────────────────────────
function tryParseJSON(str: string): unknown | null {
  try { return JSON.parse(str); } catch { return null; }
}
