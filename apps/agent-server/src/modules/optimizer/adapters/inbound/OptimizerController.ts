import { Body, Controller, Inject, Post } from "@nestjs/common";
import type { IOptimizerUseCase } from "../../ports/inbound/IOptimizerUseCase";
import type { IOptimizerTelemetry } from "../../ports/outbound/IOptimizerTelemetry";
import { OPTIMIZER_TELEMETRY, OPTIMIZER_USE_CASE } from "../../tokens";

interface RunOptimizerRequest {
  query: string;
}

@Controller("optimizer")
export class OptimizerController {
  constructor(
    @Inject(OPTIMIZER_USE_CASE)
    private readonly optimizer: IOptimizerUseCase,
    @Inject(OPTIMIZER_TELEMETRY)
    private readonly telemetry: IOptimizerTelemetry,
  ) {}

  @Post("run")
  async run(@Body() body: RunOptimizerRequest) {
    const result = await this.optimizer.run(body.query);
    await this.telemetry.record(result);
    return result;
  }
}
