import type { IConsensus } from "../../ports/outbound/IConsensus";

export class SolanaConsensusAdapter implements IConsensus {
  async submitValidation(subtaskPda: string, approved: boolean): Promise<string> {
    return `pending_consensus_submit_validation_${subtaskPda}_${approved}`;
  }

  async initializeConsensus(subtaskPda: string): Promise<string> {
    return `pending_consensus_initialize_${subtaskPda}`;
  }
}
