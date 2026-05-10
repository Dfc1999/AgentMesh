import { Body, Controller, Post } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { WORKER_USE_CASE } from "../../workers.module";
import type { WorkerTask } from "../../domain/base/types";
import type { IWorkerUseCase } from "../../ports/inbound/IWorkerUseCase";

type WorkerTaskBody = Omit<WorkerTask, "budgetLamports" | "requiredCapabilities"> & {
  budgetLamports: string | number;
  requiredCapabilities?: string | number;
};

@Controller("workers")
export class WorkerController {
  constructor(
    @Inject(WORKER_USE_CASE)
    private readonly workers: IWorkerUseCase,
  ) {}

  @Post("execute")
  async execute(@Body() body: WorkerTaskBody) {
    const result = await this.workers.execute({
      ...body,
      budgetLamports: BigInt(body.budgetLamports),
      requiredCapabilities:
        body.requiredCapabilities === undefined ? undefined : BigInt(body.requiredCapabilities),
    });

    return JSON.parse(
      JSON.stringify(result, (_key, value: unknown) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ) as unknown;
  }
}
