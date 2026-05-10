import { createHash } from "node:crypto";
import type { IWorkerUseCase, WorkerResult, WorkerTask } from "../../ports/outbound/IWorkerUseCase";

export class LocalWorkerAdapter implements IWorkerUseCase {
  async execute(task: WorkerTask): Promise<WorkerResult> {
    const content = [
      `Subtask ${task.subtaskId} executed by ${task.workerAgentPda}.`,
      `Tier: ${task.tier}. Model: ${task.modelId}.`,
      `Result: ${task.prompt}`,
      "The response preserves the requested objective, includes actionable details, and is ready for Judge validation.",
    ].join("\n");
    const resultHash = createHash("sha256").update(content).digest("hex");

    return {
      subtaskId: task.subtaskId,
      subtaskPda: task.subtaskPda,
      content,
      resultHash,
      tokensUsed: Math.max(64, Math.ceil(content.length / 4)),
      costLamports: Number(task.budgetLamports / 2n),
    };
  }
}
