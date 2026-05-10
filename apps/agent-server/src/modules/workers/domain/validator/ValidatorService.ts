import { createHash } from "node:crypto";
import { modelForPurpose } from "../../../../shared/llm/modelSelection";
import { BaseWorkerService } from "../base/BaseWorkerService";
import {
  WORKER_CAPABILITIES,
  type StructuredWorkerOutput,
  type SubtaskContext,
} from "../base/types";
import type { IConsensus } from "../../ports/outbound/IConsensus";
import type { ITaskEscrow } from "../../ports/outbound/ITaskEscrow";
import type { IWorkerLlm } from "../../ports/outbound/IWorkerLlm";

export class ValidatorService extends BaseWorkerService {
  readonly kind = "validator" as const;
  readonly agentPda = "ValidatorAgentLocal";
  private readonly votedSubtasks = new Set<string>();

  constructor(
    taskEscrow: ITaskEscrow,
    private readonly llm: IWorkerLlm,
    private readonly consensus: IConsensus,
  ) {
    super(WORKER_CAPABILITIES.VALIDATION | WORKER_CAPABILITIES.QUALITY_ASSURANCE, taskEscrow);
  }

  protected async perform(subtask: SubtaskContext): Promise<StructuredWorkerOutput> {
    if (subtask.producerAgentPda === this.agentPda) {
      throw new Error("Validator cannot validate its own worker result.");
    }
    if (this.votedSubtasks.has(subtask.subtaskPda)) {
      throw new Error(`Validator already voted for ${subtask.subtaskPda}.`);
    }

    const response = await this.llm.complete({
      model: modelForPurpose("validator"),
      messages: [
        {
          role: "user",
          content: [
            "Validate this worker result against the original brief.",
            `Brief: ${subtask.originalBrief}`,
            `Result: ${subtask.prompt}`,
            'Return JSON: {"approved":true|false,"reason":"short"}',
          ].join("\n"),
        },
      ],
      maxTokens: 240,
      temperature: 0,
      cacheSystemPrompt: true,
    });
    const parsed = parseValidation(response.content);
    const justificationHash = createHash("sha256").update(parsed.reason).digest();
    const signature = await this.consensus.submitValidation(
      subtask.subtaskPda,
      parsed.approved,
      justificationHash,
    );
    this.votedSubtasks.add(subtask.subtaskPda);

    return {
      summary: parsed.approved
        ? "Validator approved the worker result and submitted consensus validation."
        : "Validator rejected the worker result and submitted consensus validation.",
      keyFindings: [parsed.reason, `Consensus signature: ${signature}`],
      rawData: {
        approved: parsed.approved,
        justificationHash: justificationHash.toString("hex"),
      },
      confidence: parsed.approved ? 0.88 : 0.74,
    };
  }
}

function parseValidation(content: string): { approved: boolean; reason: string } {
  try {
    const parsed = JSON.parse(content) as Partial<{ approved: boolean; reason: string }>;
    return {
      approved: parsed.approved !== false,
      reason: parsed.reason || "Validator completed independent review.",
    };
  } catch {
    return {
      approved: !/fail|rechaz|incorrect|unsafe/i.test(content),
      reason: content.slice(0, 240) || "Validator completed independent review.",
    };
  }
}
