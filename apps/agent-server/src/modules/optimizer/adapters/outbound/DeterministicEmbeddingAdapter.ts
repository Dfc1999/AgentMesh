import type { IEmbeddingClient } from "../../ports/outbound/IEmbeddingClient";

const DEFAULT_DIMENSIONS = 64;

export class DeterministicEmbeddingAdapter implements IEmbeddingClient {
  constructor(private readonly dimensions = DEFAULT_DIMENSIONS) {}

  async embed(text: string): Promise<number[]> {
    const vector = Array.from({ length: this.dimensions }, () => 0);
    const tokens = text
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, " ")
      .split(/\s+/u)
      .filter(Boolean);

    for (const token of tokens) {
      const index = this.hash(token) % this.dimensions;
      vector[index] += 1;
    }

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

    if (norm === 0) {
      return vector;
    }

    return vector.map((value) => value / norm);
  }

  private hash(input: string): number {
    let hash = 5381;

    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 33) ^ input.charCodeAt(i);
    }

    return hash >>> 0;
  }
}
