import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { HealthController } from "./health.controller";
import { JudgeModule } from "./modules/judge";
import { OptimizerModule } from "./modules/optimizer";
import { OrchestratorModule } from "./modules/orchestrator";
import { RouterModule } from "./modules/router";
import { SdkGatewayModule } from "./modules/sdk-gateway";
import { WorkersModule } from "./modules/workers";
import { X402Module } from "./modules/x402";
import { LlmModule } from "./shared/llm/llm.module";
import { EpicTestController } from "./testing/epic-test.controller";

@Module({
  imports: [
    ConfigModule,
    LlmModule,
    OptimizerModule,
    RouterModule,
    JudgeModule,
    OrchestratorModule,
    SdkGatewayModule,
    WorkersModule,
    X402Module,
  ],
  controllers: [HealthController, EpicTestController],
})
export class AppModule {}
