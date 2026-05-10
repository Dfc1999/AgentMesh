import type { JudgeResult, RouterDecision, WorkerResponse } from "@agentmesh/shared-types";
import type { IJudgeUseCase } from "../ports/outbound/IJudgeUseCase";
import type { IOptimizerUseCase } from "../ports/outbound/IOptimizerUseCase";
import type { IRouterUseCase } from "../ports/outbound/IRouterUseCase";
import type { ITaskRepository } from "../ports/outbound/ITaskRepository";
import type { IWorkerUseCase } from "../ports/outbound/IWorkerUseCase";
import type {
  ExecutionPlan,
  OrchestratorConfig,
  SubtaskExecutionRecord,
  SubtaskNode,
  SubtaskTree,
  TaskBrief,
  WorkerCandidate,
} from "./types";
import type { WorkerRecruiter } from "./WorkerRecruiter";

export class ExecutionEngine {
  constructor(
    private readonly optimizer: IOptimizerUseCase,
    private readonly router: IRouterUseCase,
    private readonly judge: IJudgeUseCase,
    private readonly worker: IWorkerUseCase,
    private readonly recruiter: WorkerRecruiter,
    private readonly repository: ITaskRepository,
    private readonly config: OrchestratorConfig,
  ) {}

  buildPlan(tree: SubtaskTree): ExecutionPlan {
    const remaining = new Map(tree.subtasks.map((subtask) => [subtask.id, subtask]));
    const completed = new Set<string>();
    const levels: SubtaskNode[][] = [];

    while (remaining.size > 0) {
      const ready = [...remaining.values()].filter((subtask) =>
        subtask.dependencies.every((dependency) => completed.has(dependency)),
      );

      if (ready.length === 0) {
        throw new Error("Subtask tree cannot be topologically sorted.");
      }

      levels.push(ready);
      for (const subtask of ready) {
        remaining.delete(subtask.id);
        completed.add(subtask.id);
      }
    }

    return { levels };
  }

  async execute(task: TaskBrief, tree: SubtaskTree): Promise<SubtaskExecutionRecord[]> {
    const plan = this.buildPlan(tree);
    const results: SubtaskExecutionRecord[] = [];
    const failed = new Set<string>();

    for (const level of plan.levels) {
      const executable = level.filter((subtask) =>
        subtask.dependencies.every((dependency) => !failed.has(dependency)),
      );
      const skipped = level.filter((subtask) => !executable.includes(subtask));

      for (const subtask of skipped) {
        const record = this.createSkippedRecord(subtask);
        await this.repository.updateSubtask(record);
        results.push(record);
      }

      const settled = await Promise.allSettled(
        executable.map((subtask) => this.executeSubtask(task, subtask)),
      );

      for (const item of settled) {
        const record =
          item.status === "fulfilled"
            ? item.value
            : this.createFailedRecord(executable[settled.indexOf(item)], item.reason);
        if (record.status === "failed") {
          failed.add(record.subtask.id);
        }
        results.push(record);
      }
    }

    return results;
  }

  private async executeSubtask(
    task: TaskBrief,
    subtask: SubtaskNode,
  ): Promise<SubtaskExecutionRecord> {
    const startedAt = new Date().toISOString();
    await this.repository.updateSubtaskStatus(subtask.id, "running");
    const worker = await this.recruiter.recruit(subtask);
    const optimizedQuery = await this.optimizer.run(subtask.description);
    const subtaskPda = this.deriveSubtaskPda(task, subtask);
    const routerDecision = await this.router.classify(optimizedQuery, {
      routerAgentPda: task.routerAgentPda ?? this.config.defaultRouterAgentPda,
      subtaskPda,
      remainingBudgetLamports: subtask.estimatedBudgetLamports,
      maxRetryBudgetLamports: subtask.maxRetryBudgetLamports,
    });
    const firstAttempt = await this.worker.execute({
      subtaskId: subtask.id,
      subtaskPda,
      workerAgentPda: worker.agentPda,
      prompt: optimizedQuery.content,
      originalBrief: task.brief,
      tier: routerDecision.tier,
      modelId: routerDecision.modelId,
      budgetLamports: routerDecision.budgetSliceLamports,
    });
    const firstJudge = await this.judge.evaluate(
      toWorkerResponse(task, subtask.id, firstAttempt, routerDecision, 0),
      routerDecision,
    );

    if (firstJudge.verdict === "retry" && firstJudge.retryTier) {
      return this.retrySubtask({
        task,
        subtask,
        worker,
        optimizedQuery,
        firstDecision: routerDecision,
        firstJudge,
        startedAt,
      });
    }

    const record: SubtaskExecutionRecord = {
      subtask,
      status: firstJudge.verdict === "approved" ? "completed" : "failed",
      worker,
      optimizedQuery,
      routerDecision,
      judgeResult: firstJudge,
      resultContent: firstAttempt.content,
      resultHash: firstAttempt.resultHash,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
    await this.repository.updateSubtask(record);
    return record;
  }

  private async retrySubtask(input: {
    task: TaskBrief;
    subtask: SubtaskNode;
    worker: WorkerCandidate;
    optimizedQuery: Awaited<ReturnType<IOptimizerUseCase["run"]>>;
    firstDecision: RouterDecision;
    firstJudge: JudgeResult;
    startedAt: string;
  }): Promise<SubtaskExecutionRecord> {
    await this.repository.updateSubtaskStatus(input.subtask.id, "retrying");
    const retryResult = await this.worker.execute({
      subtaskId: input.subtask.id,
      subtaskPda: input.firstDecision.subtaskPda,
      workerAgentPda: input.worker.agentPda,
      prompt: input.optimizedQuery.content,
      originalBrief: input.task.brief,
      tier: input.firstJudge.retryTier ?? input.firstDecision.tier,
      modelId: input.firstDecision.modelId,
      budgetLamports: BigInt(input.firstDecision.maxRetryBudget),
    });
    const retryJudge = await this.judge.evaluate(
      toWorkerResponse(input.task, input.subtask.id, retryResult, input.firstDecision, 1),
      input.firstDecision,
    );
    const record: SubtaskExecutionRecord = {
      subtask: input.subtask,
      status: retryJudge.verdict === "approved" ? "completed" : "failed",
      worker: input.worker,
      optimizedQuery: input.optimizedQuery,
      routerDecision: input.firstDecision,
      judgeResult: retryJudge,
      resultContent: retryResult.content,
      resultHash: retryResult.resultHash,
      startedAt: input.startedAt,
      finishedAt: new Date().toISOString(),
    };
    await this.repository.updateSubtask(record);
    return record;
  }

  private deriveSubtaskPda(task: TaskBrief, subtask: SubtaskNode): string {
    const taskPda = task.taskPda ?? `${this.config.defaultTaskPdaPrefix}-${task.taskId}`;
    return `${taskPda}-subtask-${subtask.index}`;
  }

  private createSkippedRecord(subtask: SubtaskNode): SubtaskExecutionRecord {
    return {
      subtask,
      status: "skipped",
      error: "Dependency failed.",
      finishedAt: new Date().toISOString(),
    };
  }

  private createFailedRecord(subtask: SubtaskNode, error: unknown): SubtaskExecutionRecord {
    return {
      subtask,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finishedAt: new Date().toISOString(),
    };
  }
}

function toWorkerResponse(
  task: TaskBrief,
  subtaskId: string,
  result: {
    subtaskPda: string;
    content: string;
    tokensUsed: number;
    costLamports: number;
  },
  decision: RouterDecision,
  retryCount: number,
): WorkerResponse {
  return {
    content: result.content,
    modelId: decision.modelId,
    tier: decision.tier,
    tokensUsed: result.tokensUsed,
    costLamports: result.costLamports,
    originalBrief: task.brief,
    subtaskId,
    subtaskPda: result.subtaskPda,
    retryCount,
  };
}
