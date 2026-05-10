import type { WorkerAgent, WorkerResult, WorkerTask } from "../../domain/base/types";

export interface IWorkerUseCase {
  execute(task: WorkerTask): Promise<WorkerResult>;
  getWorker(kind: WorkerTask["kind"]): WorkerAgent | undefined;
}
