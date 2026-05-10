import type { OptimizedQuery } from "@agentmesh/shared-types";

export interface IOptimizerTelemetry {
  record(result: OptimizedQuery): Promise<void>;
}
