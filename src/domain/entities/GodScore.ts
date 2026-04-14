/**
 * src/domain/entities/GodScore.ts
 * 갓생점수 엔티티 — 핵심 도메인 계산 규칙
 */
import type { GodScoreBreakdown, CategoryWeights, FeatureWeights } from '../../../types/godScore';
import { getTierByScore, INITIAL_CATEGORY_WEIGHTS, INITIAL_FEATURE_WEIGHTS } from '../../../types/godScore';

/** 피처 카테고리별 원시 점수 (0~100) */
export interface RawCategoryScores {
  a1: number; a2: number; a3: number; a4: number;
  b1: number; b2: number; b3: number; b4: number;
  c1: number; c2: number; c3: number; c4: number;
  d1: number; d2: number; d3: number; d4: number;
}

/**
 * 갓생점수 계산 (순수 함수 — 부수효과 없음)
 * S = wA·fA + wB·fB + wC·fC + wD·fD
 */
export function calculateGodScore(
  raw: RawCategoryScores,
  categoryWeights: CategoryWeights = INITIAL_CATEGORY_WEIGHTS,
  featureWeights: FeatureWeights = INITIAL_FEATURE_WEIGHTS,
): GodScoreBreakdown {
  const fA = clamp(
    featureWeights.wA1 * raw.a1 +
    featureWeights.wA2 * raw.a2 +
    featureWeights.wA3 * raw.a3 +
    featureWeights.wA4 * raw.a4,
    0, 100,
  );
  const fB = clamp(
    featureWeights.wB1 * raw.b1 +
    featureWeights.wB2 * raw.b2 +
    featureWeights.wB3 * raw.b3 +
    featureWeights.wB4 * raw.b4,
    0, 100,
  );
  const fC = clamp(
    featureWeights.wC1 * raw.c1 +
    featureWeights.wC2 * raw.c2 +
    featureWeights.wC3 * raw.c3 +
    featureWeights.wC4 * raw.c4,
    0, 100,
  );
  const fD = clamp(
    featureWeights.wD1 * raw.d1 +
    featureWeights.wD2 * raw.d2 +
    featureWeights.wD3 * raw.d3 +
    featureWeights.wD4 * raw.d4,
    0, 100,
  );

  const totalScore = clamp(
    categoryWeights.wA * fA +
    categoryWeights.wB * fB +
    categoryWeights.wC * fC +
    categoryWeights.wD * fD,
    0, 1000,
  );

  return { fA, fB, fC, fD, totalScore };
}

/** 분기·누적 가중 합산 */
export function applyTemporalWeighting(
  quarterlyScore: number,
  historicalScore: number,
  quarterlyWeight = 0.70,
  accumulativeWeight = 0.30,
): number {
  return clamp(
    quarterlyWeight * quarterlyScore + accumulativeWeight * historicalScore,
    0, 1000,
  );
}

/** Mock 합성 데이터 기반 기본 원시 점수 생성 (3단계 테스트용) */
export function generateMockRawScores(seed = 0.6): RawCategoryScores {
  const rng = (offset: number) => clamp(Math.round((seed + offset) * 100), 0, 100);
  return {
    a1: rng(0.10), a2: rng(0.05), a3: rng(0.20), a4: rng(0.15),
    b1: rng(0.00), b2: rng(-0.10), b3: rng(0.08), b4: rng(0.03),
    c1: rng(0.12), c2: rng(0.18), c3: rng(0.06), c4: rng(-0.05),
    d1: rng(0.22), d2: rng(0.14), d3: rng(0.09), d4: rng(-0.08),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export { getTierByScore };
