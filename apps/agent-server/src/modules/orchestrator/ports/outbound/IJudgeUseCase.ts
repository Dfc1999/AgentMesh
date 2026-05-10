import type { JudgeResult, RouterDecision, WorkerResponse } from "@agentmesh/shared-types";

export interface IJudgeUseCase {
  evaluate(response: WorkerResponse, decision: RouterDecision): Promise<JudgeResult>;
}
