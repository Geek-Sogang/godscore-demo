/**
 * src/domain/entities/Mission.ts
 * 미션 엔티티 — 16개 미션 전체 정의 테이블
 */
import type { MissionDefinition } from '../../../types/mission';

/** 16개 미션 전체 정의 (기획서 26~29p 기반) */
export const MISSION_DEFINITIONS: Record<string, MissionDefinition> = {
  // ── Type A: 생활 루틴 ──────────────────────────────
  A_1: {
    id: 'A_1', category: 'A',
    name: '기상 인증',
    description: '목표 기상 시각 ±30분 이내에 기상을 인증하세요.',
    verificationMethod: 'HEALTHKIT',
    rewardPoints: 30,
    featureContribution: 1.0,
    isDaily: true,
    iconName: 'sun',
  },
  A_2: {
    id: 'A_2', category: 'A',
    name: '수면 규칙성',
    description: '6~9시간 수면 후 수면 데이터를 동기화하세요.',
    verificationMethod: 'HEALTHKIT',
    rewardPoints: 25,
    featureContribution: 1.0,
    isDaily: true,
    iconName: 'moon',
  },
  A_3: {
    id: 'A_3', category: 'A',
    name: '앱 출석 체크',
    description: '오늘 앱에 접속해 출석을 기록하세요.',
    verificationMethod: 'USAGE_STATS',
    rewardPoints: 10,
    featureContribution: 1.0,
    isDaily: true,
    iconName: 'check-circle',
  },
  A_4: {
    id: 'A_4', category: 'A',
    name: '미션 달성률',
    description: '오늘 전체 미션의 70% 이상을 완료하세요.',
    verificationMethod: 'MANUAL',
    rewardPoints: 50,
    featureContribution: 1.0,
    isDaily: true,
    iconName: 'trophy',
  },
  // ── Type B: 일·소득 ────────────────────────────────
  B_1: {
    id: 'B_1', category: 'B',
    name: '포트폴리오 업데이트',
    description: '최근 작업물 또는 포트폴리오를 업로드하세요. (AI 검증)',
    verificationMethod: 'FILE_UPLOAD',
    rewardPoints: 60,
    featureContribution: 1.0,
    isDaily: false,
    iconName: 'briefcase',
  },
  B_2: {
    id: 'B_2', category: 'B',
    name: '월 수입 입력',
    description: '이번 달 수입 내역을 입력 또는 연동하세요.',
    verificationMethod: 'MYDATA_API',
    rewardPoints: 40,
    featureContribution: 1.0,
    isDaily: false,
    iconName: 'dollar-sign',
  },
  B_3: {
    id: 'B_3', category: 'B',
    name: '수입 안정성 확인',
    description: '최근 3개월 수입 데이터를 마이데이터로 확인하세요.',
    verificationMethod: 'MYDATA_API',
    rewardPoints: 35,
    featureContribution: 1.0,
    isDaily: false,
    iconName: 'trending-up',
  },
  B_4: {
    id: 'B_4', category: 'B',
    name: '업무 완료 인증',
    description: '완료한 프로젝트/업무 결과물을 인증하세요.',
    verificationMethod: 'FILE_UPLOAD',
    rewardPoints: 70,
    featureContribution: 1.0,
    isDaily: false,
    iconName: 'check-square',
  },
  // ── Type C: 소비 행동 ──────────────────────────────
  C_1: {
    id: 'C_1', category: 'C',
    name: '소비 패턴 확인',
    description: '이번 달 지출 카테고리를 마이데이터로 확인하세요.',
    verificationMethod: 'MYDATA_API',
    rewardPoints: 25,
    featureContribution: 1.0,
    isDaily: false,
    iconName: 'pie-chart',
  },
  C_2: {
    id: 'C_2', category: 'C',
    name: '충동 결제 자제',
    description: '오늘 새벽(00:00~06:00) 결제를 하지 않으면 달성!',
    verificationMethod: 'MYDATA_API',
    rewardPoints: 20,
    featureContribution: 1.0,
    isDaily: true,
    iconName: 'shield',
  },
  C_3: {
    id: 'C_3', category: 'C',
    name: '식료품 구매 인증',
    description: '마트/장보기 영수증 또는 카드 내역을 인증하세요.',
    verificationMethod: 'RECEIPT_UPLOAD',
    rewardPoints: 20,
    featureContribution: 1.0,
    isDaily: false,
    iconName: 'shopping-cart',
  },
  C_4: {
    id: 'C_4', category: 'C',
    name: '잔고 유지',
    description: '주계좌 잔액이 목표 금액 이상 유지되면 달성!',
    verificationMethod: 'MYDATA_API',
    rewardPoints: 30,
    featureContribution: 1.0,
    isDaily: false,
    iconName: 'credit-card',
  },
  // ── Type D: 개인 ESG ───────────────────────────────
  D_1: {
    id: 'D_1', category: 'D',
    name: '운동·자기관리',
    description: '오늘 30분 이상 운동 또는 자기관리 활동을 기록하세요.',
    verificationMethod: 'HEALTHKIT',
    rewardPoints: 30,
    featureContribution: 1.0,
    isDaily: true,
    iconName: 'activity',
  },
  D_2: {
    id: 'D_2', category: 'D',
    name: '대중교통 이용',
    description: '오늘 대중교통을 이용한 내역을 인증하세요.',
    verificationMethod: 'MYDATA_API',
    rewardPoints: 25,
    featureContribution: 1.0,
    isDaily: true,
    iconName: 'map',
  },
  D_3: {
    id: 'D_3', category: 'D',
    name: '에너지 절약',
    description: '에너지 절약 실천 내역을 인증하세요.',
    verificationMethod: 'RECEIPT_UPLOAD',
    rewardPoints: 20,
    featureContribution: 1.0,
    isDaily: false,
    iconName: 'zap',
  },
  D_4: {
    id: 'D_4', category: 'D',
    name: '봉사·기부',
    description: '봉사활동 또는 기부 인증서를 업로드하세요.',
    verificationMethod: 'FILE_UPLOAD',
    rewardPoints: 80,
    featureContribution: 1.0,
    isDaily: false,
    iconName: 'heart',
  },
};

/** 카테고리별 미션 목록 조회 */
export function getMissionsByCategory(category: 'A' | 'B' | 'C' | 'D'): MissionDefinition[] {
  return Object.values(MISSION_DEFINITIONS).filter(m => m.category === category);
}

/** 일일 미션 목록만 조회 */
export function getDailyMissions(): MissionDefinition[] {
  return Object.values(MISSION_DEFINITIONS).filter(m => m.isDaily);
}
