import type { DimensionScores } from "@agentmesh/shared-types";

export interface ScoreWeights {
  completeness: number;
  consistency: number;
  formatCompliance: number;
  appropriateConfidence: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  completeness: 0.4,
  consistency: 0.25,
  formatCompliance: 0.2,
  appropriateConfidence: 0.15,
};

export class ScoreCalculator {
  constructor(private readonly weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS) {}

  calculate(dimensions: DimensionScores): number {
    const raw =
      dimensions.completeness * this.weights.completeness +
      dimensions.consistency * this.weights.consistency +
      dimensions.formatCompliance * this.weights.formatCompliance +
      dimensions.appropriateConfidence * this.weights.appropriateConfidence;

    return round(clamp(raw, 0, 1));
  }
}

export function normalizeDimensions(dimensions: Partial<DimensionScores>): DimensionScores {
  return {
    completeness: round(clamp(Number(dimensions.completeness ?? 0), 0, 1)),
    consistency: round(clamp(Number(dimensions.consistency ?? 0), 0, 1)),
    formatCompliance: round(clamp(Number(dimensions.formatCompliance ?? 0), 0, 1)),
    appropriateConfidence: round(clamp(Number(dimensions.appropriateConfidence ?? 0), 0, 1)),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
