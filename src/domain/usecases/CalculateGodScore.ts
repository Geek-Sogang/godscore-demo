/**
 * src/domain/usecases/CalculateGodScore.ts
 *
 * [수정] EMA 왜곡 수정
 *   기존: historicalScore = 매일 갱신되는 totalScore → 지수이동평균으로 변질
 *   수정: quarterlyBaseScore = 분기 정산 시점에만 고정되는 스냅샷 점수
 *         매일 점수 계산 시 quarterlyBaseScore는 변경하지 않음
 *
 *   S_daily   = wA·fA + wB·fB + wC·fC + wD·fD  (오늘 행동 점수)
 *   S_final   = 0.70 × S_daily + 0.30 × quarterlyBaseScore
 *               └ 분기 내 매일 동일한 base를 참조 → 왜곡 없음
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
  date: string;
  rawScores: RawCategoryScores;
  /**
   * [수정] 분기 시작 시점에 고정된 베이스 점수 (변경 불가)
   * 매일 계산 시 이 값은 바뀌지 않음 — 분기 정산 액션에서만 갱신
   * undefined이면 현재 일일 점수 자체를 base로 사용 (첫 분기)
   */
  quarterlyBaseScore?: number;
  categoryWeights?: CategoryWeights;
  featureWeights?: FeatureWeights;
}

export interface CalculateGodScoreOutput {
  snapshot: GodScoreSnapshot;
  shapValues: SHAPValue[];
}

export function executeCalculateGodScore(
  input: CalculateGodScoreInput,
): CalculateGodScoreOutput {
  const catW  = input.categoryWeights ?? INITIAL_CATEGORY_WEIGHTS;
  const featW = input.featureWeights  ?? INITIAL_FEATURE_WEIGHTS;

  // 1. 오늘 행동 기반 일일 점수 산출
  const dailyBreakdown: GodScoreBreakdown = calculateGodScore(
    input.rawScores, catW, featW,
  );

  // 2. 분기 베이스 점수와 가중 합산
  //    quarterlyBaseScore가 없으면 첫 분기로 간주 → 일일 점수 그대로 사용
  const base = input.quarterlyBaseScore ?? dailyBreakdown.totalScore;
  const finalScore = applyTemporalWeighting(
    dailyBreakdown.totalScore,
    base,
    QUARTERLY_WEIGHT,
    ACCUMULATIVE_WEIGHT,
  );

  const finalBreakdown: GodScoreBreakdown = {
    ...dailyBreakdown,
    totalScore: finalScore,
  };

  // 3. SHAP 값 계산
  const shapValues = computeSHAPValues(
    input.rawScores, finalScore, catW, featW,
  );

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
    movingAvg90dScore: finalScore,
    estimatedRateDiscount: 0,  // 도메인 레이어는 서버 값 미보유 → 인프라 레이어(godScoreStore)에서 덮어씀
    createdAt: new Date().toISOString(),
  };

  return { snapshot, shapValues };
}

function computeSHAPValues(
  raw: RawCategoryScores,
  baselineScore: number,
  catW: CategoryWeights,
  featW: FeatureWeights,
): SHAPValue[] {
  const features: Array<{ id: string; name: string; score: number; weight: number }> = [
    { id: 'A_1', name: '기상 인증',          score: raw.a1, weight: catW.wA * featW.wA1 },
    { id: 'A_2', name: '수면 규칙성',        score: raw.a2, weight: catW.wA * featW.wA2 },
    { id: 'A_3', name: '앱 출석 일관성',     score: raw.a3, weight: catW.wA * featW.wA3 },
    { id: 'A_4', name: '미션 달성률',        score: raw.a4, weight: catW.wA * featW.wA4 },
    { id: 'B_1', name: '포트폴리오 업데이트', score: raw.b1, weight: catW.wB * featW.wB1 },
    { id: 'B_2', name: '월 수입 변동성',     score: raw.b2, weight: catW.wB * featW.wB2 },
    { id: 'B_3', name: '수입 안정성',        score: raw.b3, weight: catW.wB * featW.wB3 },
    { id: 'B_4', name: '업무 완료 인증',     score: raw.b4, weight: catW.wB * featW.wB4 },
    { id: 'C_1', name: '소비 패턴 규칙성',   score: raw.c1, weight: catW.wC * featW.wC1 },
    { id: 'C_2', name: '충동 결제 자제',     score: raw.c2, weight: catW.wC * featW.wC2 },
    { id: 'C_3', name: '식료품 구매',        score: raw.c3, weight: catW.wC * featW.wC3 },
    { id: 'C_4', name: '잔고 유지',          score: raw.c4, weight: catW.wC * featW.wC4 },
    { id: 'D_1', name: '운동·자기관리',      score: raw.d1, weight: catW.wD * featW.wD1 },
    { id: 'D_2', name: '대중교통·친환경',    score: raw.d2, weight: catW.wD * featW.wD2 },
    { id: 'D_3', name: '에너지 절약',        score: raw.d3, weight: catW.wD * featW.wD3 },
    { id: 'D_4', name: '봉사·기부',          score: raw.d4, weight: catW.wD * featW.wD4 },
  ];
  const avgScore = 50;
  return features.map(f => ({
    featureId: f.id,
    featureName: f.name,
    shapValue: parseFloat(((f.score - avgScore) * f.weight).toFixed(2)),
    baselineScore,
  }));
}
