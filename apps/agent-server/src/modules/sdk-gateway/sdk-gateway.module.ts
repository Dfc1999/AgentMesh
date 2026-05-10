import { Module } from "@nestjs/common";
import { SdkGatewayController } from "./adapters/inbound/SdkGatewayController";
import { SdkGatewayService } from "./domain/SdkGatewayService";

export const SDK_GATEWAY_USE_CASE = Symbol("SDK_GATEWAY_USE_CASE");

@Module({
  controllers: [SdkGatewayController],
  providers: [
    {
      provide: SDK_GATEWAY_USE_CASE,
      useFactory: () => new SdkGatewayService(),
    },
  ],
  exports: [SDK_GATEWAY_USE_CASE],
})
export class SdkGatewayModule {}
