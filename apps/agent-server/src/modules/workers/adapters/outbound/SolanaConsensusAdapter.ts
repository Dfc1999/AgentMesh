import type { ConsensusClient } from "../../../../shared/solana/programs";
import type { IConsensus } from "../../ports/outbound/IConsensus";

export class SolanaConsensusAdapter implements IConsensus {
  constructor(private readonly consensus: ConsensusClient) {}

  async submitValidation(
    subtaskPda: string,
    approved: boolean,
    justificationHash: Buffer,
  ): Promise<string> {
    const tx = await this.consensus.submitValidation({
      subtaskPda,
      approved,
      justificationHash,
    });
    return tx.signature;
  }
}
