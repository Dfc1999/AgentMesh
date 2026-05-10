import type { OptimizedQuery, QualityRisk, RetrievedChunk } from "@agentmesh/shared-types";

export type OptimizerTechnique =
  | "semantic_cache"
  | "intent_classifier"
  | "skill_match_exact"
  | "skill_match_partial"
  | "rag_search"
  | "context_pruning"
  | "prompt_cache";

export type IntentName =
  | "market_research"
  | "code_review"
  | "defi_arbitrage"
  | "data_analysis"
  | "text_summary"
  | "general";

export interface OptimizerFeatureFlags {
  semanticCache: boolean;
  intentClassifier: boolean;
  skillMatching: boolean;
  ragSearch: boolean;
  contextPruning: boolean;
  promptCache: boolean;
}

export interface OptimizerConfig {
  semanticCacheThreshold: number;
  skillExactThreshold: number;
  skillPartialThreshold: number;
  ragTopK: number;
  ragMinScore: number;
  pruningDuplicateThreshold: number;
  pruningMinRelevance: number;
  defaultCacheTtlSeconds: number;
  defiCacheTtlSeconds: number;
  featureFlags: OptimizerFeatureFlags;
}

export interface IntentAnalysis {
  intent: IntentName;
  needsDocs: boolean;
  complexityHint: number;
  skillId?: string;
}

export interface SkillTemplate {
  id: string;
  name: string;
  template: string;
  capabilityMask: number;
  exampleQueries: string[];
}

export interface SkillMatch {
  skill: SkillTemplate;
  similarity: number;
  renderedTemplate: string;
  exact: boolean;
}

export interface PipelineMetrics {
  originalTokens: number;
  processedTokens: number;
  reductionPercent: number;
  techniquesApplied: OptimizerTechnique[];
  estimatedQualityRisk: QualityRisk;
  latencyMs: number;
  cacheHit: boolean;
  cacheSimilarity?: number;
  tokensSavedByCache: number;
  chunksBeforePruning: number;
  chunksAfterPruning: number;
  tokensEliminatedByPruning: number;
  promptCacheEnabled: boolean;
  promptCachedTokens: number;
}

export interface OptimizerPipelineState {
  rawQuery: string;
  processedQuery: string;
  queryEmbedding?: number[];
  intent: IntentAnalysis;
  skillMatch?: SkillMatch;
  chunks: RetrievedChunk[];
  metrics: PipelineMetrics;
  cachedResponse?: string;
  shortCircuit: boolean;
}

export interface PipelineStep {
  readonly name: OptimizerTechnique;
  run(state: OptimizerPipelineState): Promise<OptimizerPipelineState>;
}

export interface OptimizerEvaluationReport {
  totalQueries: number;
  threshold: number;
  techniques: Array<{
    technique: OptimizerTechnique;
    avgSimilarity: number;
    minSimilarity: number;
    safe: boolean;
  }>;
}

export type { OptimizedQuery, RetrievedChunk };
