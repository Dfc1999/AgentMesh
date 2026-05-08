import type { RouterDecision } from "@agentmesh/shared-types";
import type { JudgeResult, WorkerResponse } from "../../domain/types";

export interface IJudgeUseCase {
  evaluate(response: WorkerResponse, decision: RouterDecision): Promise<JudgeResult>;
}
