import type { OptimizerTechnique } from "../../domain/types";

export interface SemanticCacheHit {
  responseSummary: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface StoreSemanticCacheEntryInput {
  embedding: number[];
  responseSummary: string;
  metadata: {
    intent: string;
    techniquesApplied: OptimizerTechnique[];
  };
  ttlSeconds: number;
}

export interface ISemanticCacheStore {
  search(embedding: number[], threshold: number): Promise<SemanticCacheHit | null>;
  store(input: StoreSemanticCacheEntryInput): Promise<void>;
}
