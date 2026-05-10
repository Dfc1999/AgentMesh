import type { OrchestrationResult, TaskBrief } from "../../domain/types";

export interface IOrchestratorUseCase {
  start(task: TaskBrief): Promise<OrchestrationResult>;
  getStatus(taskId: string): Promise<OrchestrationResult | null>;
}
