/**
 * src/infrastructure/blockchain/keccak256.ts
 * keccak256 해시 모듈 (React Native 호환)
 *
 * ⚠️  React Native는 Node.js crypto 모듈 미지원
 *     → crypto-js의 SHA3 함수(outputLength: 256)로 keccak256 구현
 *     ethers.js v6 사용 시 react-native-get-random-values polyfill 필요
 *
 * 기획서 33p 파이프라인:
 *   keccak256(userId + missionId + utcTimestamp + rawDataSerialized)
 *   → 위변조 불가능한 고유 식별 값 생성 → 스마트 컨트랙트 저장
 */
import CryptoJS from 'crypto-js';
import type { HashInput, VerificationResult } from '../../../types/blockchain';

/**
 * keccak256 해시 계산
 * crypto-js SHA3 with 256-bit output = keccak256
 */
export function computeKeccak256(data: string): string {
  return CryptoJS.SHA3(data, { outputLength: 256 }).toString(CryptoJS.enc.Hex);
}

/**
 * HashInput 구조체를 직렬화 후 keccak256 해싱
 * 순서 고정: userId|missionId|utcTimestamp|rawDataSerialized
 */
export function hashMissionInput(input: HashInput): string {
  const serialized = [
    input.userId,
    input.missionId,
    input.utcTimestamp.toString(),
    input.rawDataSerialized,
  ].join('|');
  return computeKeccak256(serialized);
}

/**
 * SHA-256 해시 (Anti-Tamper: 클라이언트 원시 데이터 검증용)
 * Step 2 파이프라인: 클라이언트에서 raw_data_hash를 SHA-256으로 첨부
 */
export function computeSHA256(data: string): string {
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
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
 * Mock 트랜잭션 해시 생성 (실제 블록체인 연동 전 테스트용)
 * 형식: 0x + 64자리 hex (Ethereum tx hash 형식 모사)
 */
export function generateMockTxHash(missionLogId: string): string {
  const mockData = `${missionLogId}_${Date.now()}_mock_tx`;
  return '0x' + computeKeccak256(mockData);
}
