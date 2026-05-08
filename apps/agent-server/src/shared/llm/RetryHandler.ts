export class RetryHandler {
  constructor(private readonly delaysMs = [1000, 2000, 4000]) {}

  async run<T>(operation: () => Promise<T>, isRetryable = RetryHandler.defaultRetryable): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.delaysMs.length; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === this.delaysMs.length || !isRetryable(error)) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, this.delaysMs[attempt]));
      }
    }

    throw lastError;
  }

  private static defaultRetryable(error: unknown): boolean {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    const maybeStatus = error as { status?: number; code?: string };
    return maybeStatus.status === 429 || maybeStatus.status === 500 || maybeStatus.code === "ETIMEDOUT";
  }
}
