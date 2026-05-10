import type { IProofCache } from "../../ports/outbound/IProofCache";

export class InMemoryProofCacheAdapter implements IProofCache {
  private readonly used = new Map<string, number>();

  async isAlreadyUsed(signature: string): Promise<boolean> {
    const expiresAt = this.used.get(signature);
    if (!expiresAt) {
      return false;
    }
    if (expiresAt < Date.now()) {
      this.used.delete(signature);
      return false;
    }
    return true;
  }

  async markUsed(signature: string, ttlSeconds: number): Promise<void> {
    this.used.set(signature, Date.now() + ttlSeconds * 1000);
  }
}
