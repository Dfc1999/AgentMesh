export type AgentClass = "worker" | "router" | "judge" | "optimizer" | "validator";

export type Tier = "simple" | "medium" | "complex";

export type ModelId =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-6"
  | "claude-opus-4-6"
  | "gpt-4.1-mini"
  | "gpt-4.1"
  | "gpt-5"
  | "gemini-flash-2.0"
  | "gemini-pro-2.5";

export type QualityRisk = "none" | "low" | "medium" | "high";

export interface IntentClassification {
  needsDocs: boolean;
  complexityHint: number;
  skillId?: string;
  skillMatch?: string;
}

export interface OptimizerMetrics {
  cacheHit: boolean;
  originalTokens: number;
  processedTokens: number;
  reductionPercent: number;
  techniquesApplied: string[];
  estimatedQualityRisk: QualityRisk;
  latencyMs: number;
}

export interface OptimizedQuery {
  content: string;
  intentClassification: IntentClassification;
  metrics: OptimizerMetrics;
  cachedResponse?: string;
  contextChunks?: RetrievedChunk[];
}

export interface RetrievedChunk {
  id: string;
  source: string;
  content: string;
  score: number;
}

export interface RoutingRules {
  simpleMaxTokens: number;
  simpleMaxComplexity: number;
  mediumMaxTokens: number;
  mediumMaxComplexity: number;
  minReputationScore?: number;
  maxRetries?: number;
}

export type RouterWarning =
  | "budget_degraded"
  | "insufficient_budget"
  | "cache_hit"
  | "skill_template_match";

export interface RouterDecision {
  tier: Tier;
  modelId: ModelId;
  budgetSlice: number;
  budgetSliceLamports: bigint;
  maxRetryBudget: number;
  subtaskPda: string;
  confidence: number;
  reasoning: string;
  warnings: RouterWarning[];
  declareTierSignature?: string;
  cachedResponse?: string;
}

export interface WorkerResponse {
  content: string;
  modelId: ModelId;
  tier: Tier;
  tokensUsed: number;
  costLamports: number;
  originalBrief: string;
  subtaskId: string;
  subtaskPda: string;
  retryCount?: number;
}

export interface DimensionScores {
  completeness: number;
  consistency: number;
  formatCompliance: number;
  appropriateConfidence: number;
}

export type JudgeVerdict = "approved" | "retry" | "low_confidence";

export interface JudgeResult {
  verdict: JudgeVerdict;
  score: number;
  dimensions: DimensionScores;
  retryTier?: Tier;
  lowConfidenceReason?: string;
  finalContent?: string;
  tierWasAccurate: boolean;
  subtaskId: string;
  consensusSignature?: string;
  retrySignature?: string;
  tierAccuracySignature?: string;
}

export interface CompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model: ModelId;
  messages: CompletionMessage[];
  systemPrompt?: string;
  maxTokens: number;
  temperature?: number;
  cacheSystemPrompt?: boolean;
}

export interface CompletionResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  latencyMs: number;
  provider: "anthropic" | "openai" | "google" | "mock";
  model: ModelId;
}

export type {
  AgentRecord,
  OptimizerMetricRecord,
  SubtaskRecord,
  TaskRecord,
} from "./db";
