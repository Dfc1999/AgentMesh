import type { RetrySubtaskInput, ITaskEscrow } from "../../ports/outbound/ITaskEscrow";

export class SolanaTaskEscrowAdapter implements ITaskEscrow {
  async retrySubtask(input: RetrySubtaskInput): Promise<string> {
    return `pending_task_escrow_retry_${input.subtaskPda}_${input.newTier}`;
  }
}
