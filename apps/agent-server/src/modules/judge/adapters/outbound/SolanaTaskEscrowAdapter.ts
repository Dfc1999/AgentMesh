import type { TaskEscrowClient } from "../../../../shared/solana/programs";
import type { RetrySubtaskInput, ITaskEscrow } from "../../ports/outbound/ITaskEscrow";

export class SolanaTaskEscrowAdapter implements ITaskEscrow {
  constructor(private readonly taskEscrow: TaskEscrowClient) {}

  async retrySubtask(input: RetrySubtaskInput): Promise<string> {
    const tx = await this.taskEscrow.retrySubtask(input);
    return tx.signature;
  }
}
