import type { TaskEscrowClient } from "../../../../shared/solana/programs";
import type { ITaskEscrow, DeclareTierInput } from "../../ports/outbound/ITaskEscrow";

export class SolanaTaskEscrowAdapter implements ITaskEscrow {
  constructor(private readonly taskEscrow: TaskEscrowClient) {}

  async declareTier(input: DeclareTierInput): Promise<string> {
    const tx = await this.taskEscrow.declareTier(input);
    return tx.signature;
  }
}
