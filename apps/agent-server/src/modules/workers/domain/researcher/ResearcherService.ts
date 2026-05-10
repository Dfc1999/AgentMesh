import type { ModelId } from "@agentmesh/shared-types";
import { BaseWorkerService } from "../base/BaseWorkerService";
import {
  WORKER_CAPABILITIES,
  type StructuredWorkerOutput,
  type SubtaskContext,
} from "../base/types";
import type { ITaskEscrow } from "../../ports/outbound/ITaskEscrow";
import type { IWorkerLlm } from "../../ports/outbound/IWorkerLlm";
import type { IPythonSubprocess } from "../../ports/outbound/IPythonSubprocess";
import type { IWebSearchClient } from "../../ports/outbound/IWebSearchClient";
import type { IX402Client } from "../../ports/outbound/IX402Client";

export class ResearcherService extends BaseWorkerService {
  readonly kind = "researcher" as const;
  readonly agentPda = "ResearcherAgentLocal";

  constructor(
    taskEscrow: ITaskEscrow,
    private readonly llm: IWorkerLlm,
    private readonly webSearch: IWebSearchClient,
    private readonly x402: IX402Client,
    private readonly python: IPythonSubprocess,
    private readonly researcherScriptPath: string,
  ) {
    super(
      WORKER_CAPABILITIES.RESEARCH |
        WORKER_CAPABILITIES.WEB_SEARCH |
        WORKER_CAPABILITIES.DATA_COLLECTION,
      taskEscrow,
    );
  }

  protected async perform(subtask: SubtaskContext): Promise<StructuredWorkerOutput> {
    const searchResults = await this.webSearch.search(subtask.prompt);
    const paidData = await this.x402.fetch(
      "https://api.agentmesh.local/research-context",
      subtask.walletKeypairPath,
      {
        agentId: this.agentPda,
        subtaskId: subtask.subtaskId,
        maxPriceLamports: subtask.budgetLamports / 20n,
      },
    );
    const pythonResult = await this.python
      .run<
        { prompt: string; searchResults: typeof searchResults; paidData: string },
        { summary: string; key_findings: string[]; raw_data_hash: string }
      >(this.researcherScriptPath, {
        prompt: subtask.prompt,
        searchResults,
        paidData: paidData.body,
      })
      .catch(() => ({
        summary: `Research synthesis for: ${subtask.prompt}`,
        key_findings: searchResults.map((item) => item.snippet),
        raw_data_hash: "python-fallback",
      }));
    const response = await this.llm.complete({
      model: modelForTier(subtask.tier),
      messages: [
        {
          role: "user",
          content: [
            "Synthesize a concise research result with citations.",
            `Prompt: ${subtask.prompt}`,
            `Python summary: ${pythonResult.summary}`,
            `Findings: ${pythonResult.key_findings.join("; ")}`,
          ].join("\n"),
        },
      ],
      maxTokens: 500,
      temperature: 0,
      cacheSystemPrompt: true,
    });

    return {
      summary: response.content,
      keyFindings: pythonResult.key_findings,
      citations: searchResults.map((item) => ({ title: item.title, url: item.url })),
      rawData: {
        rawDataHash: pythonResult.raw_data_hash,
        x402PaymentSignature: paidData.paymentSignature,
      },
      confidence: 0.84,
    };
  }
}

function modelForTier(tier: SubtaskContext["tier"]): ModelId {
  return tier === "simple" ? "claude-haiku-4-5" : "claude-sonnet-4-6";
}
