import type { IWorkerUseCase } from "../ports/inbound/IWorkerUseCase";
import type { SubtaskContext, WorkerAgent, WorkerKind, WorkerResult } from "./base/types";

export class WorkerRegistryService implements IWorkerUseCase {
  private readonly workers: Map<WorkerKind, WorkerAgent>;

  constructor(workers: WorkerAgent[]) {
    this.workers = new Map(workers.map((worker) => [worker.kind, worker]));
  }

  async execute(task: SubtaskContext): Promise<WorkerResult> {
    const worker = task.kind
      ? this.workers.get(task.kind)
      : [...this.workers.values()].find((candidate) =>
          candidate.canHandle(task.requiredCapabilities ?? 0n),
        );

    if (!worker) {
      throw new Error(`No worker available for ${task.kind ?? "requested capabilities"}.`);
    }

    return worker.execute(task);
  }

  getWorker(kind: WorkerKind | undefined): WorkerAgent | undefined {
    return kind ? this.workers.get(kind) : undefined;
  }
}
