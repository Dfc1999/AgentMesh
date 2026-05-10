import type { TaskEscrowClient } from "../../../../shared/solana/programs";
import type { ITaskEscrow } from "../../ports/outbound/ITaskEscrow";

export class SolanaTaskEscrowAdapter implements ITaskEscrow {
  constructor(private readonly taskEscrow: TaskEscrowClient) {}

  async submitResult(subtaskPda: string, resultHash: string): Promise<string> {
    const tx = await this.taskEscrow.submitResult({ subtaskPda, resultHash });
    return tx.signature;
  }
}
