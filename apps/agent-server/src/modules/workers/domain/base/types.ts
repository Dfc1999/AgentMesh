import type { ModelId, Tier } from "@agentmesh/shared-types";

export type WorkerKind = "researcher" | "analyzer" | "executor" | "validator";

export const WORKER_CAPABILITIES = {
  RESEARCH: 1n << 0n,
  WEB_SEARCH: 1n << 1n,
  DATA_COLLECTION: 1n << 2n,
  ANALYSIS: 1n << 3n,
  DATA_PROCESSING: 1n << 4n,
  REPORT_GENERATION: 1n << 5n,
  EXECUTION: 1n << 6n,
  DEFI: 1n << 7n,
  SWAP: 1n << 8n,
  VALIDATION: 1n << 9n,
  QUALITY_ASSURANCE: 1n << 10n,
} as const;

export interface SubtaskContext {
  subtaskId: string;
  subtaskPda: string;
  kind?: WorkerKind;
  prompt: string;
  originalBrief: string;
  tier: Tier;
  modelId: ModelId;
  budgetLamports: bigint;
  workerAgentPda?: string;
  producerAgentPda?: string;
  requiredCapabilities?: bigint;
  walletKeypairPath?: string;
}

export type WorkerTask = SubtaskContext;

export interface WorkerResult {
  subtaskId: string;
  subtaskPda: string;
  workerKind: WorkerKind;
  workerAgentPda: string;
  content: string;
  resultData: unknown;
  resultHash: string;
  tokensUsed: number;
  costLamports: number;
  confidence: number;
  submitResultSignature?: string;
}

export interface WorkerAgent {
  readonly kind: WorkerKind;
  readonly agentPda: string;
  canHandle(capabilities: bigint): boolean;
  execute(subtask: SubtaskContext): Promise<WorkerResult>;
  getCapabilities(): bigint;
}

export interface StructuredWorkerOutput {
  summary: string;
  keyFindings: string[];
  citations?: Array<{ title: string; url: string }>;
  rawData?: unknown;
  confidence: number;
}
