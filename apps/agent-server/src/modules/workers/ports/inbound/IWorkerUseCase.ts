import type { WorkerResult, WorkerTask } from "../../domain/base/types";

export interface IWorkerUseCase {
  execute(task: WorkerTask): Promise<WorkerResult>;
}
