import type { RetrievedChunk } from "@agentmesh/shared-types";

export interface IVectorStore {
  search(embedding: number[], topK: number, minScore: number): Promise<RetrievedChunk[]>;
}
