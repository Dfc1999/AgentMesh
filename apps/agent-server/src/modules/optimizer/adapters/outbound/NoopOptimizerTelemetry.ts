import type { IOptimizerTelemetry } from "../../ports/outbound/IOptimizerTelemetry";

export class NoopOptimizerTelemetry implements IOptimizerTelemetry {
  async record(): Promise<void> {
    return undefined;
  }
}
