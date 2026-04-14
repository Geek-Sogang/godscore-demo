/**
 * types/blockchain.ts
 * 블록체인 무결성 관련 타입 정의
 * 기획서 33p 파이프라인 기반
 *
 * 흐름:
 *   미션완료 → Kafka → keccak256 해시 → 스마트컨트랙트 → blockchain_records INSERT
 *   검증:      keccak256 재계산 → 온체인 해시 비교 → verified: true/false
 *
 * React Native 주의: ethers.js 사용 시 react-native-get-random-values polyfill 필요
 *                    현 단계에서는 crypto-js의 SHA3(keccak) 활용
 */

import type { MissionFeatureId } from './features';

/** keccak256 해시 입력 데이터 구조 */
export interface HashInput {
  userId: string;
  missionId: MissionFeatureId;
  /** UTC 타임스탬프 (밀리초) */
  utcTimestamp: number;
  /** 원시 데이터 직렬화 문자열 */
  rawDataSerialized: string;
}

/** 블록체인 기록 항목 (blockchain_records 테이블 대응) */
export interface BlockchainRecord {
  id: string;
  /** 연관 미션 로그 ID */
  missionLogId: string;
  userId: string;
  missionId: MissionFeatureId;
  /** keccak256 해시값 */
  keccak256Hash: string;
  /** 블록체인 트랜잭션 해시 */
  txHash: string;
  /** 블록 번호 */
  blockNumber: number | null;
  /** 스마트 컨트랙트 주소 */
  contractAddress: string;
  /** 온체인 확인 여부 */
  onChainConfirmed: boolean;
  /** 검증 결과 */
  verified: boolean;
  /** 검증 실패 사유 */
  verificationError: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

/** 데이터 검증 결과 */
export interface VerificationResult {
  missionLogId: string;
  /** 로컬 재계산 해시 */
  recomputedHash: string;
  /** 온체인 저장 해시 */
  onChainHash: string;
  /** 검증 통과 여부 */
  verified: boolean;
  /** 검증 수행 시각 */
  verifiedAt: string;
  /** 불일치 원인 (verified=false 시) */
  mismatchReason: string | null;
}

/** Mock 블록체인 이벤트 (Kafka 이벤트 대응) */
export interface BlockchainEvent {
  eventType: 'MISSION_COMPLETED' | 'SCORE_UPDATED' | 'POINT_EARNED';
  payload: HashInput;
  /** 이벤트 발행 시각 */
  publishedAt: string;
  /** 처리 상태 */
  processStatus: 'PENDING' | 'PROCESSING' | 'RECORDED' | 'FAILED';
}

/** 무결성 검증 요청 (금융 감독 팀용) */
export interface IntegrityAuditRequest {
  userId: string;
  /** 검증 기간 시작 (YYYY-MM-DD) */
  fromDate: string;
  /** 검증 기간 종료 (YYYY-MM-DD) */
  toDate: string;
  missionIds?: MissionFeatureId[];
}

/** 무결성 검증 리포트 */
export interface IntegrityAuditReport {
  request: IntegrityAuditRequest;
  totalRecords: number;
  verifiedCount: number;
  failedCount: number;
  results: VerificationResult[];
  generatedAt: string;
}
