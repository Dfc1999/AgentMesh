import type { RetrievedChunk } from "@agentmesh/shared-types";
import type { IEmbeddingClient } from "../../ports/outbound/IEmbeddingClient";
import type { IVectorStore } from "../../ports/outbound/IVectorStore";
import { cosineSimilarity } from "../../domain/utils";

interface KnowledgeChunk extends RetrievedChunk {
  embedding?: number[];
}

const DEFAULT_CHUNKS: KnowledgeChunk[] = [
  {
    id: "defi-liquidity-risk",
    source: "agentmesh://knowledge/defi/liquidity-risk",
    score: 1,
    content:
      "For DeFi routing, compare pool depth, current fees, slippage, oracle freshness, MEV exposure, and settlement risk before execution.",
  },
  {
    id: "market-research-template",
    source: "agentmesh://knowledge/research/market-analysis",
    score: 1,
    content:
      "Market research tasks should include target segment, competitor list, pricing signals, adoption risks, and cited evidence for claims.",
  },
  {
    id: "agentmesh-token-optimizer",
    source: "agentmesh://knowledge/optimizer/token-budgeting",
    score: 1,
    content:
      "AgentMesh optimizer must preserve user intent while reducing prompt tokens through semantic cache, skill templates, RAG, and pruning.",
  },
];

export class InMemoryVectorStore implements IVectorStore {
  private indexed?: Promise<KnowledgeChunk[]>;

  constructor(
    private readonly embedder: IEmbeddingClient,
    private readonly chunks: KnowledgeChunk[] = DEFAULT_CHUNKS,
  ) {}

  async search(embedding: number[], topK: number, minScore: number): Promise<RetrievedChunk[]> {
    const indexed = await this.indexChunks();

    return indexed
      .map((chunk) => ({
        ...chunk,
        score: chunk.embedding ? cosineSimilarity(embedding, chunk.embedding) : 0,
      }))
      .filter((chunk) => chunk.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((chunk) => ({
        id: chunk.id,
        source: chunk.source,
        content: chunk.content,
        score: chunk.score,
      }));
  }

  private indexChunks(): Promise<KnowledgeChunk[]> {
    this.indexed ??= Promise.all(
      this.chunks.map(async (chunk) => ({
        ...chunk,
        embedding: await this.embedder.embed(chunk.content),
      })),
    );

    return this.indexed;
  }
}
