import type { RetrySubtaskInput, ITaskEscrow } from "../../../ports/outbound/ITaskEscrow";

export class MockTaskEscrow implements ITaskEscrow {
  readonly retries: RetrySubtaskInput[] = [];

  async retrySubtask(input: RetrySubtaskInput): Promise<string> {
    this.retries.push(input);
    return `mockRetry_${input.subtaskPda}_${input.newTier}`;
  }
}
