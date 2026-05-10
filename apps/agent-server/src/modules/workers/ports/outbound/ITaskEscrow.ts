export interface ITaskEscrow {
  submitResult(subtaskPda: string, resultHash: string): Promise<string>;
}
