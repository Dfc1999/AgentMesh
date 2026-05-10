import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { SDK_GATEWAY_USE_CASE } from "../../sdk-gateway.module";
import type { RegisterAgentInput } from "../../domain/types";
import type { ISdkGatewayUseCase } from "../../ports/inbound/ISdkGatewayUseCase";

interface RegisterAgentBody extends Omit<RegisterAgentInput, "pricePerTaskLamports"> {
  pricePerTaskLamports: string | number;
}

@Controller("sdk")
export class SdkGatewayController {
  constructor(
    @Inject(SDK_GATEWAY_USE_CASE)
    private readonly sdkGateway: ISdkGatewayUseCase,
  ) {}

  @Post("agents")
  registerAgent(@Body() body: RegisterAgentBody) {
    return serialize(
      this.sdkGateway.registerAgent({
        ...body,
        pricePerTaskLamports: BigInt(body.pricePerTaskLamports),
      }),
    );
  }

  @Get("agents")
  queryAgents(
    @Query("capability") capability?: string | string[],
    @Query("agentClass") agentClass?: RegisterAgentInput["agentClass"],
    @Query("minReputationScore") minReputationScore?: string,
    @Query("maxPricePerTaskLamports") maxPricePerTaskLamports?: string,
  ) {
    const capabilities = Array.isArray(capability) ? capability : capability ? [capability] : [];
    return serialize(
      this.sdkGateway.queryAgents({
        capabilities,
        agentClass,
        minReputationScore:
          minReputationScore === undefined ? undefined : Number(minReputationScore),
        maxPricePerTaskLamports:
          maxPricePerTaskLamports === undefined ? undefined : BigInt(maxPricePerTaskLamports),
      }),
    );
  }

  @Get("agents/:agentId/reputation")
  getAgentReputation(@Param("agentId") agentId: string) {
    return this.sdkGateway.getAgentReputation(agentId);
  }

  @Post("tasks/:taskId/cancel")
  cancelTask(@Param("taskId") taskId: string) {
    return this.sdkGateway.cancelTask(taskId);
  }
}

function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;
}
