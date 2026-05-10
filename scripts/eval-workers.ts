import { createMockSolanaProgramClients } from "../apps/agent-server/src/shared/solana/programs";
import { DeterministicWebSearchAdapter } from "../apps/agent-server/src/modules/workers/adapters/outbound/DeterministicWebSearchAdapter";
import { JupiterSwapAdapter } from "../apps/agent-server/src/modules/workers/adapters/outbound/JupiterSwapAdapter";
import { PythOracleAdapter } from "../apps/agent-server/src/modules/workers/adapters/outbound/PythOracleAdapter";
import { PythonSubprocessAdapter } from "../apps/agent-server/src/modules/workers/adapters/outbound/PythonSubprocessAdapter";
import { SolanaConsensusAdapter } from "../apps/agent-server/src/modules/workers/adapters/outbound/SolanaConsensusAdapter";
import { SolanaTaskEscrowAdapter } from "../apps/agent-server/src/modules/workers/adapters/outbound/SolanaTaskEscrowAdapter";
import { X402ClientAdapter } from "../apps/agent-server/src/modules/workers/adapters/outbound/X402ClientAdapter";
import { AnalyzerService } from "../apps/agent-server/src/modules/workers/domain/analyzer/AnalyzerService";
import { ExecutorService } from "../apps/agent-server/src/modules/workers/domain/executor/ExecutorService";
import { WORKER_CAPABILITIES } from "../apps/agent-server/src/modules/workers/domain/base/types";
import { ResearcherService } from "../apps/agent-server/src/modules/workers/domain/researcher/ResearcherService";
import { ValidatorService } from "../apps/agent-server/src/modules/workers/domain/validator/ValidatorService";
import { WorkerRegistryService } from "../apps/agent-server/src/modules/workers/domain/WorkerRegistryService";
import type { IWorkerLlm } from "../apps/agent-server/src/modules/workers/ports/outbound/IWorkerLlm";
import type {
  IX402ClientUseCase,
  X402PaymentRequest,
  X402PaymentResult,
} from "../apps/agent-server/src/modules/x402";
import type { CompletionRequest, CompletionResponse } from "../packages/shared-types/src";

async function main() {
  const clients = createMockSolanaProgramClients();
  const escrow = new SolanaTaskEscrowAdapter(clients.taskEscrow);
  const consensus = new SolanaConsensusAdapter(clients.consensus);
  const llm = new EvalWorkerLlm();
  const python = new PythonSubprocessAdapter();
  const registry = new WorkerRegistryService([
    new ResearcherService(
      escrow,
      llm,
      new DeterministicWebSearchAdapter(),
      new X402ClientAdapter(new EvalX402Client()),
      python,
      "workers-py/researcher/researcher.py",
    ),
    new AnalyzerService(escrow, llm, python, "workers-py/analyzer/analyzer.py"),
    new ExecutorService(escrow, new PythOracleAdapter(), new JupiterSwapAdapter()),
    new ValidatorService(escrow, llm, consensus),
  ]);

  const tasks = [
    {
      kind: "researcher" as const,
      requiredCapabilities: WORKER_CAPABILITIES.RESEARCH | WORKER_CAPABILITIES.WEB_SEARCH,
      prompt: "Research the AgentMesh worker market.",
    },
    {
      kind: "analyzer" as const,
      requiredCapabilities: WORKER_CAPABILITIES.ANALYSIS,
      prompt: "Analyze pricing and risk patterns from collected research.",
    },
    {
      kind: "executor" as const,
      requiredCapabilities: WORKER_CAPABILITIES.EXECUTION | WORKER_CAPABILITIES.DEFI,
      prompt: "Simulate a guarded SOL to USDC swap.",
    },
    {
      kind: "validator" as const,
      requiredCapabilities: WORKER_CAPABILITIES.VALIDATION,
      prompt: "Validate that the worker response satisfies the brief.",
    },
  ];
  const rows = [];

  for (const task of tasks) {
    const result = await registry.execute({
      subtaskId: `eval-${task.kind}`,
      subtaskPda: `SubtaskPda-${task.kind}`,
      workerAgentPda: `${task.kind}-agent`,
      kind: task.kind,
      prompt: task.prompt,
      originalBrief: "Evaluate EPIC-07 worker behavior.",
      tier: task.kind === "executor" ? "complex" : "medium",
      modelId: "claude-sonnet-4-6",
      budgetLamports: 2_000_000n,
      requiredCapabilities: task.requiredCapabilities,
      producerAgentPda: task.kind === "validator" ? "DifferentWorkerAgent" : undefined,
    });
    rows.push({
      kind: result.workerKind,
      hash: result.resultHash.slice(0, 10),
      signature: result.submitResultSignature ?? "",
      confidence: result.confidence,
    });
  }

  console.table(rows);

  if (rows.length !== 4 || rows.some((row) => !row.signature)) {
    throw new Error("Workers eval failed.");
  }
}

class EvalWorkerLlm implements IWorkerLlm {
  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const wantsJson = req.messages.some((message) => message.content.includes("Return JSON"));
    return {
      content: wantsJson
        ? JSON.stringify({ approved: true, reason: "Eval validation approved." })
        : "Synthesized worker output with structured findings and clear confidence.",
      inputTokens: 100,
      outputTokens: 60,
      cachedTokens: 0,
      latencyMs: 1,
      provider: "mock",
      model: req.model,
    };
  }
}

class EvalX402Client implements IX402ClientUseCase {
  async fetchWithPayment(request: X402PaymentRequest): Promise<X402PaymentResult> {
    return {
      paid: true,
      signature: `eval-x402-${request.agentId}-${request.subtaskId ?? "subtask"}`,
      responseStatus: 200,
      responseBody: "Eval paid data response.",
    };
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
