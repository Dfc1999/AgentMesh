export interface IConsensus {
  submitValidation(
    subtaskPda: string,
    approved: boolean,
    justificationHash: Buffer,
  ): Promise<string>;
  initializeConsensus?(
    subtaskPda: string,
    requiredSigs: number,
    validators: string[],
  ): Promise<string>;
}
