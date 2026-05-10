import type {
  SubtaskExecutionRecord,
  SubtaskStatus,
  SubtaskTree,
  TaskBrief,
  TaskExecutionState,
} from "../../domain/types";
import type { ITaskRepository } from "../../ports/outbound/ITaskRepository";

export class InMemoryTaskRepository implements ITaskRepository {
  private readonly tasks = new Map<string, TaskExecutionState>();

  async saveTask(task: TaskBrief, tree: SubtaskTree): Promise<TaskExecutionState> {
    const records = Object.fromEntries(
      tree.subtasks.map((subtask) => [
        subtask.id,
        {
          subtask,
          status: "pending" as const,
        },
      ]),
    );
    const state: TaskExecutionState = {
      task,
      tree,
      records,
      status: "accepted",
    };
    this.tasks.set(task.taskId, state);
    return state;
  }

  async updateSubtask(record: SubtaskExecutionRecord): Promise<void> {
    const state = this.findStateBySubtask(record.subtask.id);
    if (!state) {
      return;
    }
    state.records[record.subtask.id] = record;
  }

  async updateSubtaskStatus(
    subtaskId: string,
    status: SubtaskStatus,
    error?: string,
  ): Promise<void> {
    const state = this.findStateBySubtask(subtaskId);
    if (!state) {
      return;
    }
    const existing = state.records[subtaskId];
    if (!existing) {
      return;
    }
    state.records[subtaskId] = {
      ...existing,
      status,
      error: error ?? existing.error,
    };
  }

  async markTaskComplete(taskId: string, releaseSignature?: string): Promise<void> {
    const state = this.tasks.get(taskId);
    if (!state) {
      return;
    }
    state.status = "completed";
    state.releaseOrchestratorFeeSignature = releaseSignature;
  }

  async markTaskPartialFailure(taskId: string): Promise<void> {
    const state = this.tasks.get(taskId);
    if (state) {
      state.status = "partial_failure";
    }
  }

  async getTask(taskId: string): Promise<TaskExecutionState | null> {
    return this.tasks.get(taskId) ?? null;
  }

  private findStateBySubtask(subtaskId: string): TaskExecutionState | undefined {
    return [...this.tasks.values()].find((state) => Boolean(state.records[subtaskId]));
  }
}
