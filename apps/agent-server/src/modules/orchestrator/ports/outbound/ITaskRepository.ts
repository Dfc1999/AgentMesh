import type {
  SubtaskExecutionRecord,
  SubtaskStatus,
  SubtaskTree,
  TaskBrief,
  TaskExecutionState,
} from "../../domain/types";

export interface ITaskRepository {
  saveTask(task: TaskBrief, tree: SubtaskTree): Promise<TaskExecutionState>;
  updateSubtask(record: SubtaskExecutionRecord): Promise<void>;
  updateSubtaskStatus(subtaskId: string, status: SubtaskStatus, error?: string): Promise<void>;
  markTaskComplete(taskId: string, releaseSignature?: string): Promise<void>;
  markTaskPartialFailure(taskId: string): Promise<void>;
  getTask(taskId: string): Promise<TaskExecutionState | null>;
}
