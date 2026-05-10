import type {
  ISemanticCacheStore,
  SemanticCacheHit,
  StoreSemanticCacheEntryInput,
} from "../../ports/outbound/ISemanticCacheStore";
import { cosineSimilarity, stableHash } from "../../domain/utils";

interface CacheEntry {
  id: string;
  embedding: number[];
  responseSummary: string;
  metadata: Record<string, unknown>;
  expiresAt: number;
}

export class InMemorySemanticCacheAdapter implements ISemanticCacheStore {
  private readonly entries = new Map<string, CacheEntry>();

  async search(embedding: number[], threshold: number): Promise<SemanticCacheHit | null> {
    const now = Date.now();
    let best: SemanticCacheHit | null = null;

    for (const entry of this.entries.values()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(entry.id);
        continue;
      }

      const similarity = cosineSimilarity(embedding, entry.embedding);

      if (similarity >= threshold && (!best || similarity > best.similarity)) {
        best = {
          responseSummary: entry.responseSummary,
          similarity,
          metadata: entry.metadata,
        };
      }
    }

    return best;
  }

  async store(input: StoreSemanticCacheEntryInput): Promise<void> {
    const id = stableHash(JSON.stringify(input.embedding.slice(0, 16)) + input.responseSummary);

    this.entries.set(id, {
      id,
      embedding: input.embedding,
      responseSummary: input.responseSummary,
      metadata: input.metadata,
      expiresAt: Date.now() + input.ttlSeconds * 1000,
    });
  }
}
