export class RateLimiter {
  private nextAvailableAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const delayMs = Math.max(0, this.nextAvailableAt - now);
    this.nextAvailableAt = Math.max(now, this.nextAvailableAt) + this.minIntervalMs;

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
