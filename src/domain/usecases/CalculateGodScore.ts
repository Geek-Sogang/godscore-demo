/**
 * src/domain/usecases/CalculateGodScore.ts
 * 갓생점수 계산 유즈케이스
 *
 * 책임: 피처 점수 입력 → 갓생점수(S) 산출 + SHAP 값 계산
 * 의존성: Domain 엔티티만 참조 (Infrastructure/Application 참조 금지)
 */
import {
  calculateGodScore,
  applyTemporalWeighting,
  type RawCategoryScores,
} from '../entities/GodScore';
import { getTierByScore } from '../../../types/godScore';
import type {
  GodScoreBreakdown,
  CategoryWeights,
  FeatureWeights,
  SHAPValue,
  GodScoreSnapshot,
} from '../../../types/godScore';
import {
  INITIAL_CATEGORY_WEIGHTS,
  INITIAL_FEATURE_WEIGHTS,
  QUARTERLY_WEIGHT,
  ACCUMULATIVE_WEIGHT,
} from '../../../types/godScore';

export interface CalculateGodScoreInput {
  userId: string;
  date: string;                         // YYYY-MM-DD
  rawScores: RawCategoryScores;
  historicalScore?: number;             // 이전 누적 점수 (없으면 현재 분기 점수만 사용)
  categoryWeights?: CategoryWeights;
  featureWeights?: FeatureWeights;
}

export interface CalculateGodScoreOutput {
  snapshot: GodScoreSnapshot;
  shapValues: SHAPValue[];
}

/**
 * 갓생점수 계산 유즈케이스 실행
 */
export function executeCalculateGodScore(
  input: CalculateGodScoreInput,
): CalculateGodScoreOutput {
  const catW = input.categoryWeights ?? INITIAL_CATEGORY_WEIGHTS;
  const featW = input.featureWeights ?? INITIAL_FEATURE_WEIGHTS;

  // 1. 피처별 점수 산출
  const breakdown: GodScoreBreakdown = calculateGodScore(
    input.rawScores,
    catW,
    featW,
  );

  // 2. 시간 가중 합산 (분기 70% + 누적 30%)
  const historical = input.historicalScore ?? breakdown.totalScore;
  const finalScore = applyTemporalWeighting(
    breakdown.totalScore,
    historical,
    QUARTERLY_WEIGHT,
    ACCUMULATIVE_WEIGHT,
  );
  const finalBreakdown: GodScoreBreakdown = { ...breakdown, totalScore: finalScore };

  // 3. SHAP 값 계산 (각 세부 피처가 최종 점수에 기여하는 값)
  const shapValues = computeSHAPValues(input.rawScores, finalScore, catW, featW);

  // 4. 등급 산출
  const tier = getTierByScore(finalScore);

  const snapshot: GodScoreSnapshot = {
    id: `snapshot_${input.userId}_${input.date}`,
    userId: input.userId,
    date: input.date,
    breakdown: finalBreakdown,
    weights: catW,
    featureWeights: featW,
    shapValues,
    tier,
    quarterlyWeight: QUARTERLY_WEIGHT,
    accumulativeWeight: ACCUMULATIVE_WEIGHT,
    movingAvg90dScore: finalScore, // 실서비스에서는 90일 이동평균으로 교체
    createdAt: new Date().toISOString(),
  };

  return { snapshot, shapValues };
}

/**
 * Mock SHAP 값 계산
 * 실서비스: XGBoost SHAP API 호출 → 여기서는 선형 기여도 근사값
 */
function computeSHAPValues(
  raw: RawCategoryScores,
  baselineScore: number,
  catW: CategoryWeights,
  featW: FeatureWeights,
): SHAPValue[] {
  const features: Array<{ id: string; name: string; score: number; weight: number }> = [
    { id: 'A_1', name: '기상 인증', score: raw.a1, weight: catW.wA * featW.wA1 },
    { id: 'A_2', name: '수면 규칙성', score: raw.a2, weight: catW.wA * featW.wA2 },
    { id: 'A_3', name: '앱 출석 일관성', score: raw.a3, weight: catW.wA * featW.wA3 },
    { id: 'A_4', name: '미션 달성률', score: raw.a4, weight: catW.wA * featW.wA4 },
    { id: 'B_1', name: '포트폴리오 업데이트', score: raw.b1, weight: catW.wB * featW.wB1 },
    { id: 'B_2', name: '월 수입 변동성', score: raw.b2, weight: catW.wB * featW.wB2 },
    { id: 'B_3', name: '수입 안정성', score: raw.b3, weight: catW.wB * featW.wB3 },
    { id: 'B_4', name: '업무 완료 인증', score: raw.b4, weight: catW.wB * featW.wB4 },
    { id: 'C_1', name: '소비 패턴 규칙성', score: raw.c1, weight: catW.wC * featW.wC1 },
    { id: 'C_2', name: '충동 결제 자제', score: raw.c2, weight: catW.wC * featW.wC2 },
    { id: 'C_3', name: '식료품 구매', score: raw.c3, weight: catW.wC * featW.wC3 },
    { id: 'C_4', name: '잔고 유지', score: raw.c4, weight: catW.wC * featW.wC4 },
    { id: 'D_1', name: '운동·자기관리', score: raw.d1, weight: catW.wD * featW.wD1 },
    { id: 'D_2', name: '대중교통·친환경', score: raw.d2, weight: catW.wD * featW.wD2 },
    { id: 'D_3', name: '에너지 절약', score: raw.d3, weight: catW.wD * featW.wD3 },
    { id: 'D_4', name: '봉사·기부', score: raw.d4, weight: catW.wD * featW.wD4 },
  ];

  const avgScore = 50; // 기준선: 피처 평균 점수
  return features.map(f => ({
    featureId: f.id,
    featureName: f.name,
    shapValue: parseFloat(((f.score - avgScore) * f.weight).toFixed(2)),
    baselineScore,
  }));
}
