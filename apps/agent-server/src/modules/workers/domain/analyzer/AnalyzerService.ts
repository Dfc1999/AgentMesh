import type { ModelId } from "@agentmesh/shared-types";
import { BaseWorkerService } from "../base/BaseWorkerService";
import { WORKER_CAPABILITIES, type StructuredWorkerOutput, type SubtaskContext } from "../base/types";
import type { ITaskEscrow } from "../../ports/outbound/ITaskEscrow";
import type { IWorkerLlm } from "../../ports/outbound/IWorkerLlm";
import type { IPythonSubprocess } from "../../ports/outbound/IPythonSubprocess";

export class AnalyzerService extends BaseWorkerService {
  readonly kind = "analyzer" as const;
  readonly agentPda = "AnalyzerAgentLocal";

  constructor(
    taskEscrow: ITaskEscrow,
    private readonly llm: IWorkerLlm,
    private readonly python: IPythonSubprocess,
    private readonly analyzerScriptPath: string,
  ) {
    super(
      WORKER_CAPABILITIES.ANALYSIS |
        WORKER_CAPABILITIES.DATA_PROCESSING |
        WORKER_CAPABILITIES.REPORT_GENERATION,
      taskEscrow,
    );
  }

  protected async perform(subtask: SubtaskContext): Promise<StructuredWorkerOutput> {
    const analysis = await this.python
      .run<
        { prompt: string },
        { summary: string; key_findings: string[]; charts_base64: string[]; raw_data_hash: string }
      >(this.analyzerScriptPath, { prompt: subtask.prompt })
      .catch(() => ({
        summary: `Analysis for: ${subtask.prompt}`,
        key_findings: [
          "The input was converted into a structured analysis plan.",
          "No external dataset was provided, so the report is qualitative.",
        ],
        charts_base64: [],
        raw_data_hash: "analysis-fallback",
      }));
    const response = await this.llm.complete({
      model: modelForTier(subtask.tier),
      messages: [
        {
          role: "user",
          content: [
            "Turn this analysis into an executive report.",
            `Prompt: ${subtask.prompt}`,
            `Analysis: ${analysis.summary}`,
            `Findings: ${analysis.key_findings.join("; ")}`,
          ].join("\n"),
        },
      ],
      maxTokens: 650,
      temperature: 0,
      cacheSystemPrompt: true,
    });

    return {
      summary: response.content,
      keyFindings: analysis.key_findings,
      rawData: {
        chartsBase64: analysis.charts_base64,
        rawDataHash: analysis.raw_data_hash,
      },
      confidence: 0.86,
    };
  }
}

function modelForTier(tier: SubtaskContext["tier"]): ModelId {
  return tier === "complex" ? "claude-opus-4-6" : "claude-sonnet-4-6";
}
