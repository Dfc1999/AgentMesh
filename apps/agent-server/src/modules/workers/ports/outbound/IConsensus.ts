export interface IConsensus {
  submitValidation(
    subtaskPda: string,
    approved: boolean,
    justificationHash: Buffer,
  ): Promise<string>;
}
