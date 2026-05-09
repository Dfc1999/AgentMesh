import type { IConsensus } from "../../../ports/outbound/IConsensus";

export class MockConsensus implements IConsensus {
  readonly validations: Array<{
    subtaskPda: string;
    approved: boolean;
    justificationHash: Buffer;
  }> = [];

  async submitValidation(
    subtaskPda: string,
    approved: boolean,
    justificationHash: Buffer,
  ): Promise<string> {
    this.validations.push({ subtaskPda, approved, justificationHash });
    return `mockConsensus_${subtaskPda}_${approved}`;
  }
}
