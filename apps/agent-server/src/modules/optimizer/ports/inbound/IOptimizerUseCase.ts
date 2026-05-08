import type { OptimizedQuery } from "@agentmesh/shared-types";

export interface IOptimizerUseCase {
  run(rawQuery: string): Promise<OptimizedQuery>;
}
