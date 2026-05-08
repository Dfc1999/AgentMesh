export interface TaskBrief {
  taskId: string;
  creatorPubkey: string;
  brief: string;
  budgetLamports: bigint;
}

export interface OrchestrationResult {
  taskId: string;
  status: "accepted" | "rejected";
  subtaskCount: number;
}
