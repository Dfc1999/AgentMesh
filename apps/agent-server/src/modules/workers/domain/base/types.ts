export type WorkerKind = "researcher" | "analyzer" | "executor" | "validator";

export interface WorkerTask {
  subtaskPda: string;
  kind: WorkerKind;
  prompt: string;
  budgetLamports: bigint;
}

export interface WorkerResult {
  subtaskPda: string;
  content: string;
  resultHash: string;
}
