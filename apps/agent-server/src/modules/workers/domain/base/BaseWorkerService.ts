import { createHash } from "node:crypto";
import type { ITaskEscrow } from "../../ports/outbound/ITaskEscrow";
import type {
  StructuredWorkerOutput,
  SubtaskContext,
  WorkerAgent,
  WorkerKind,
  WorkerResult,
} from "./types";

export abstract class BaseWorkerService implements WorkerAgent {
  abstract readonly kind: WorkerKind;
  abstract readonly agentPda: string;

  constructor(
    private readonly capabilities: bigint,
    private readonly taskEscrow: ITaskEscrow,
  ) {}

  canHandle(capabilities: bigint): boolean {
    return capabilities === 0n || (this.capabilities & capabilities) === capabilities;
  }

  getCapabilities(): bigint {
    return this.capabilities;
  }

  async execute(subtask: SubtaskContext): Promise<WorkerResult> {
    if (!this.canHandle(subtask.requiredCapabilities ?? 0n)) {
      throw new Error(`${this.kind} worker cannot handle requested capabilities.`);
    }

    this.log(subtask, "started");
    const output = await this.perform(subtask);
    const content = renderOutput(output);
    const resultHash = this.calculateResultHash(content, output);
    const submitResultSignature = await this.taskEscrow.submitResult(
      subtask.subtaskPda,
      resultHash,
    );
    this.log(subtask, "submitted_result", { submitResultSignature });

    return {
      subtaskId: subtask.subtaskId,
      subtaskPda: subtask.subtaskPda,
      workerKind: this.kind,
      workerAgentPda: this.agentPda,
      content,
      resultData: output,
      resultHash,
      tokensUsed: estimateTokens(content),
      costLamports: Math.min(
        Number(subtask.budgetLamports),
        Math.max(1, Math.floor(Number(subtask.budgetLamports) * 0.5)),
      ),
      confidence: output.confidence,
      submitResultSignature,
    };
  }

  protected abstract perform(subtask: SubtaskContext): Promise<StructuredWorkerOutput>;

  protected calculateResultHash(content: string, output: unknown): string {
    return createHash("sha256").update(content).update(stableStringify(output)).digest("hex");
  }

  protected log(subtask: SubtaskContext, event: string, extra: Record<string, unknown> = {}): void {
    console.info(
      JSON.stringify({
        module: "workers",
        worker_kind: this.kind,
        worker_agent: this.agentPda,
        subtask_id: subtask.subtaskId,
        event,
        ...extra,
      }),
    );
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? item.toString() : item,
  );
}

function renderOutput(output: StructuredWorkerOutput): string {
  const findings = output.keyFindings.map((finding) => `- ${finding}`).join("\n");
  const citations =
    output.citations && output.citations.length > 0
      ? `\n\nSources:\n${output.citations.map((item) => `- ${item.title}: ${item.url}`).join("\n")}`
      : "";

  return `${output.summary}\n\nKey findings:\n${findings}${citations}`;
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}
