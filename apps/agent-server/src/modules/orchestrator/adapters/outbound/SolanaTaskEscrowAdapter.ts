import type { TaskEscrowClient } from "../../../../shared/solana/programs";
import type { AllocateSubtaskInput, ITaskEscrow } from "../../ports/outbound/ITaskEscrow";

export class SolanaTaskEscrowAdapter implements ITaskEscrow {
  constructor(private readonly taskEscrow: TaskEscrowClient) {}

  async allocateSubtask(input: AllocateSubtaskInput): Promise<string> {
    const tx = await this.taskEscrow.allocateSubtask(input);
    return tx.signature;
  }

  async releaseOrchestratorFee(taskPda: string): Promise<string> {
    const tx = await this.taskEscrow.releaseOrchestratorFee(taskPda);
    return tx.signature;
  }
}
