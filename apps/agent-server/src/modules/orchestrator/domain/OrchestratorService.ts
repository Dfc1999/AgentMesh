import { capabilityMaskFor } from "./capabilities";
import type { ExecutionEngine } from "./ExecutionEngine";
import type { TaskDecomposer } from "./TaskDecomposer";
import type { TimeoutManager } from "./TimeoutManager";
import type {
  OrchestrationResult,
  OrchestratorConfig,
  SubtaskTree,
  TaskBrief,
} from "./types";
import type { IOptimizerUseCase } from "../ports/outbound/IOptimizerUseCase";
import type { ISolanaEvents } from "../ports/outbound/ISolanaEvents";
import type { ITaskEscrow } from "../ports/outbound/ITaskEscrow";
import type { ITaskRepository } from "../ports/outbound/ITaskRepository";

export class OrchestratorService {
  constructor(
    private readonly optimizer: IOptimizerUseCase,
    private readonly decomposer: TaskDecomposer,
    private readonly executionEngine: ExecutionEngine,
    private readonly taskEscrow: ITaskEscrow,
    private readonly repository: ITaskRepository,
    private readonly solanaEvents: ISolanaEvents,
    private readonly timeoutManager: TimeoutManager,
    private readonly config: OrchestratorConfig,
  ) {
    this.solanaEvents.subscribeToSubtaskEvents((event) => {
      if (event.type === "TimeoutClaimed") {
        void this.repository.updateSubtaskStatus(
          event.subtaskPda,
          "failed",
          `Timeout claimed on-chain in ${event.signature}.`,
        );
      }
    });
  }

  async start(task: TaskBrief): Promise<OrchestrationResult> {
    if (task.budgetLamports <= 0n) {
      return {
        taskId: task.taskId,
        status: "rejected",
        subtaskCount: 0,
        completedSubtasks: 0,
        failedSubtasks: 0,
        records: [],
      };
    }

    const normalizedTask = this.normalizeTask(task);
    const optimizedBrief = await this.optimizer.run(normalizedTask.brief);
    const orchestratorFeeLamports = this.calculateOrchestratorFee(normalizedTask.budgetLamports);
    const tree = await this.decomposer.decompose({
      task: normalizedTask,
      optimizedBrief,
      orchestratorFeeLamports,
    });
    await this.repository.saveTask(normalizedTask, tree);
    await this.allocateSubtasks(normalizedTask, tree);

    const records = await this.executionEngine.execute(normalizedTask, tree);
    const timedOut = this.timeoutManager.findTimedOut(records);
    for (const record of timedOut) {
      await this.repository.updateSubtaskStatus(record.subtask.id, "failed", "Subtask heartbeat expired.");
    }

    const completed = records.filter((record) => record.status === "completed").length;
    const failed = records.filter(
      (record) => record.status === "failed" || record.status === "skipped",
    ).length;
    const allCompleted = completed === tree.subtasks.length;
    const releaseSignature = allCompleted
      ? await this.taskEscrow.releaseOrchestratorFee(this.taskPda(normalizedTask))
      : undefined;

    if (allCompleted) {
      await this.repository.markTaskComplete(normalizedTask.taskId, releaseSignature);
    } else {
      await this.repository.markTaskPartialFailure(normalizedTask.taskId);
    }

    return {
      taskId: normalizedTask.taskId,
      status: allCompleted ? "completed" : "partial_failure",
      subtaskCount: tree.subtasks.length,
      completedSubtasks: completed,
      failedSubtasks: failed,
      releaseOrchestratorFeeSignature: releaseSignature,
      records,
    };
  }

  async getStatus(taskId: string): Promise<OrchestrationResult | null> {
    const state = await this.repository.getTask(taskId);
    if (!state) {
      return null;
    }

    const records = Object.values(state.records);
    return {
      taskId,
      status: state.status,
      subtaskCount: state.tree.subtasks.length,
      completedSubtasks: records.filter((record) => record.status === "completed").length,
      failedSubtasks: records.filter(
        (record) => record.status === "failed" || record.status === "skipped",
      ).length,
      releaseOrchestratorFeeSignature: state.releaseOrchestratorFeeSignature,
      records,
    };
  }

  private async allocateSubtasks(task: TaskBrief, tree: SubtaskTree): Promise<void> {
    for (const subtask of tree.subtasks) {
      const allocateSignature = await this.taskEscrow.allocateSubtask({
        taskPda: this.taskPda(task),
        subtaskPda: `${this.taskPda(task)}-subtask-${subtask.index}`,
        index: subtask.index,
        parentSubtaskPda: subtask.parentSubtaskId,
        budgetLamports: subtask.estimatedBudgetLamports,
        maxRetryBudgetLamports: subtask.maxRetryBudgetLamports,
        estimatedTier: subtask.estimatedTier,
      });
      await this.repository.updateSubtask({
        subtask,
        status: "allocated",
        allocateSignature,
      });
    }
  }

  private normalizeTask(task: TaskBrief): TaskBrief {
    return {
      ...task,
      taskPda: task.taskPda ?? this.taskPda(task),
      routerAgentPda: task.routerAgentPda ?? this.config.defaultRouterAgentPda,
      orchestratorAgentPda:
        task.orchestratorAgentPda ??
        `OrchestratorAgent-${capabilityMaskFor(["orchestration"]).toString()}`,
    };
  }

  private taskPda(task: TaskBrief): string {
    return task.taskPda ?? `${this.config.defaultTaskPdaPrefix}-${task.creatorPubkey}-${task.taskId}`;
  }

  private calculateOrchestratorFee(totalBudget: bigint): bigint {
    return (totalBudget * BigInt(this.config.orchestratorFeeBps)) / 10_000n;
  }
}
