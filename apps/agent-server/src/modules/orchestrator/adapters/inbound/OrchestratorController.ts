import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { ORCHESTRATOR_USE_CASE } from "../../orchestrator.module";
import type { IOrchestratorUseCase } from "../../ports/inbound/IOrchestratorUseCase";
import type { TaskBrief } from "../../domain/types";

interface StartTaskBody {
  taskId?: string;
  creatorPubkey: string;
  brief: string;
  budgetLamports: string | number;
  taskPda?: string;
  routerAgentPda?: string;
  orchestratorAgentPda?: string;
  timeoutSlots?: number;
}

@Controller("orchestrator")
export class OrchestratorController {
  constructor(
    @Inject(ORCHESTRATOR_USE_CASE)
    private readonly orchestrator: IOrchestratorUseCase,
  ) {}

  @Post("tasks")
  async start(@Body() body: StartTaskBody) {
    const result = await this.orchestrator.start(toTaskBrief(body));
    return serializeResult(result);
  }

  @Get("tasks/:taskId")
  async status(@Param("taskId") taskId: string) {
    const result = await this.orchestrator.getStatus(taskId);
    return result ? serializeResult(result) : { ok: false, taskId, status: "not_found" };
  }
}

function toTaskBrief(body: StartTaskBody): TaskBrief {
  return {
    taskId: body.taskId ?? `task-${Date.now()}`,
    creatorPubkey: body.creatorPubkey,
    brief: body.brief,
    budgetLamports: BigInt(body.budgetLamports),
    taskPda: body.taskPda,
    routerAgentPda: body.routerAgentPda,
    orchestratorAgentPda: body.orchestratorAgentPda,
    timeoutSlots: body.timeoutSlots,
  };
}

function serializeResult<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;
}
