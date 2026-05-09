import type { ITaskEscrow, DeclareTierInput } from "../../ports/outbound/ITaskEscrow";

export class SolanaTaskEscrowAdapter implements ITaskEscrow {
  async declareTier(input: DeclareTierInput): Promise<string> {
    return `pending_task_escrow_declare_tier_${input.subtaskPda}_${input.tier}`;
  }
}
