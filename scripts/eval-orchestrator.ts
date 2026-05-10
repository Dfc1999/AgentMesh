import type {
  CompletionRequest,
  CompletionResponse,
  JudgeResult,
  OptimizedQuery,
  RouterDecision,
} from "../packages/shared-types/src/index";
import { InMemoryTaskRepository } from "../apps/agent-server/src/modules/orchestrator/adapters/outbound/InMemoryTaskRepository";
import { LocalWorkerAdapter } from "../apps/agent-server/src/modules/orchestrator/adapters/outbound/LocalWorkerAdapter";
import { NoopSolanaEventsAdapter } from "../apps/agent-server/src/modules/orchestrator/adapters/outbound/NoopSolanaEventsAdapter";
import { ExecutionEngine } from "../apps/agent-server/src/modules/orchestrator/domain/ExecutionEngine";
import { OrchestratorService } from "../apps/agent-server/src/modules/orchestrator/domain/OrchestratorService";
import { TaskDecomposer } from "../apps/agent-server/src/modules/orchestrator/domain/TaskDecomposer";
import { TimeoutManager } from "../apps/agent-server/src/modules/orchestrator/domain/TimeoutManager";
import { WorkerRecruiter } from "../apps/agent-server/src/modules/orchestrator/domain/WorkerRecruiter";
import type { OrchestratorConfig, WorkerCandidate } from "../apps/agent-server/src/modules/orchestrator/domain/types";
import type { IAgentRegistry } from "../apps/agent-server/src/modules/orchestrator/ports/outbound/IAgentRegistry";
import type { IJudgeUseCase } from "../apps/agent-server/src/modules/orchestrator/ports/outbound/IJudgeUseCase";
import type { IOptimizerUseCase } from "../apps/agent-server/src/modules/orchestrator/ports/outbound/IOptimizerUseCase";
import type { IOrchestratorLlm } from "../apps/agent-server/src/modules/orchestrator/ports/outbound/IOrchestratorLlm";
import type { IRouterUseCase } from "../apps/agent-server/src/modules/orchestrator/ports/outbound/IRouterUseCase";
import type { ITaskEscrow } from "../apps/agent-server/src/modules/orchestrator/ports/outbound/ITaskEscrow";

const config: OrchestratorConfig = {
  minWorkerReputation: -10,
  orchestratorFeeBps: 1200,
  defaultRouterAgentPda: "RouterAgentEval",
  defaultTaskPdaPrefix: "TaskPdaEval",
  defaultSubtaskBudgetLamports: 1_000_000n,
  defaultMaxRetryBudgetLamports: 300_000n,
};

async function main() {
  const repository = new InMemoryTaskRepository();
  const registry = new EvalAgentRegistry();
  const recruiter = new WorkerRecruiter(registry, config.minWorkerReputation);
  const optimizer = new EvalOptimizer();
  const router = new EvalRouter();
  const judge = new EvalJudge();
  const worker = new LocalWorkerAdapter();
  const taskEscrow = new EvalTaskEscrow();
  const decomposer = new TaskDecomposer(new EvalDecomposerLlm());
  const timeoutManager = new TimeoutManager({ heartbeatMs: 30_000, subtaskTimeoutMs: 120_000 });
  const executionEngine = new ExecutionEngine(
    optimizer,
    router,
    judge,
    worker,
    recruiter,
    repository,
    config,
  );
  const orchestrator = new OrchestratorService(
    optimizer,
    decomposer,
    executionEngine,
    taskEscrow,
    repository,
    new NoopSolanaEventsAdapter(),
    timeoutManager,
    config,
  );

  const result = await orchestrator.start({
    taskId: "eval-orchestrator-001",
    creatorPubkey: "CreatorEval111",
    brief:
      "Research AgentMesh competitors. Analyze pricing and risks. Validate the final recommendation.",
    budgetLamports: 9_000_000n,
  });

  console.table(
    result.records.map((record) => ({
      subtask: record.subtask.id,
      status: record.status,
      worker: record.worker?.agentPda ?? "",
      verdict: record.judgeResult?.verdict ?? "",
    })),
  );
  console.log(
    `Orchestrator result: ${result.status} (${result.completedSubtasks}/${result.subtaskCount})`,
  );

  if (result.status !== "completed" || result.completedSubtasks !== result.subtaskCount) {
    throw new Error("Orchestrator eval failed.");
  }
}

class EvalDecomposerLlm implements IOrchestratorLlm {
  async complete(_req: CompletionRequest): Promise<CompletionResponse> {
    return {
      content: JSON.stringify({
        subtasks: [
          {
            id: "subtask-1",
            description: "Research AgentMesh competitors and collect comparable offerings.",
            dependencies: [],
            estimatedTier: "medium",
            estimatedBudgetLamports: 2_500_000,
            requiredCapabilities: ["research"],
            agentClass: "worker",
          },
          {
            id: "subtask-2",
            description: "Analyze pricing, risks, and tradeoffs from the research notes.",
            dependencies: ["subtask-1"],
            estimatedTier: "medium",
            estimatedBudgetLamports: 2_500_000,
            requiredCapabilities: ["analysis"],
            agentClass: "worker",
          },
          {
            id: "subtask-3",
            description: "Validate the recommendation and produce final QA notes.",
            dependencies: ["subtask-2"],
            estimatedTier: "simple",
            estimatedBudgetLamports: 1_500_000,
            requiredCapabilities: ["validation"],
            agentClass: "validator",
          },
        ],
      }),
      inputTokens: 120,
      outputTokens: 220,
      cachedTokens: 0,
      latencyMs: 1,
      provider: "mock",
      model: "claude-sonnet-4-6",
    };
  }
}

class EvalAgentRegistry implements IAgentRegistry {
  async getAgentsByCapability(capabilityMask: bigint): Promise<WorkerCandidate[]> {
    return [
      {
        agentPda: "WorkerHighRep",
        reputationScore: 55,
        pricePerTaskLamports: 400_000n,
        capabilities: ["research", "analysis", "validation"],
        capabilityMask,
        isLocal: true,
      },
      {
        agentPda: "WorkerLowRep",
        reputationScore: -30,
        pricePerTaskLamports: 100_000n,
        capabilities: ["research"],
        capabilityMask,
        isLocal: true,
      },
    ];
  }
}

class EvalOptimizer implements IOptimizerUseCase {
  async run(rawQuery: string): Promise<OptimizedQuery> {
    return {
      content: rawQuery,
      intentClassification: {
        needsDocs: /research|competitor/i.test(rawQuery),
        complexityHint: /validate/i.test(rawQuery) ? 0.25 : 0.55,
      },
      metrics: {
        cacheHit: false,
        originalTokens: rawQuery.length,
        processedTokens: Math.ceil(rawQuery.length * 0.8),
        reductionPercent: 20,
        techniquesApplied: ["intent_classifier"],
        estimatedQualityRisk: "low",
        latencyMs: 1,
      },
    };
  }
}

class EvalRouter implements IRouterUseCase {
  async classify(query: OptimizedQuery, escrowCtx: Parameters<IRouterUseCase["classify"]>[1]): Promise<RouterDecision> {
    const tier = query.intentClassification.complexityHint > 0.5 ? "medium" : "simple";
    return {
      tier,
      modelId: tier === "medium" ? "claude-sonnet-4-6" : "claude-haiku-4-5",
      budgetSlice: Number(escrowCtx.remainingBudgetLamports),
      budgetSliceLamports: escrowCtx.remainingBudgetLamports,
      maxRetryBudget: Number(escrowCtx.maxRetryBudgetLamports ?? 0n),
      subtaskPda: escrowCtx.subtaskPda,
      confidence: 0.9,
      reasoning: "Eval router decision.",
      warnings: [],
      declareTierSignature: "eval-declare-tier",
    };
  }
}

class EvalJudge implements IJudgeUseCase {
  async evaluate(response: Parameters<IJudgeUseCase["evaluate"]>[0]): Promise<JudgeResult> {
    return {
      verdict: "approved",
      score: 0.88,
      dimensions: {
        completeness: 0.9,
        consistency: 0.88,
        formatCompliance: 0.86,
        appropriateConfidence: 0.88,
      },
      finalContent: response.content,
      tierWasAccurate: true,
      subtaskId: response.subtaskId,
      consensusSignature: "eval-consensus",
      tierAccuracySignature: "eval-tier-accuracy",
    };
  }
}

class EvalTaskEscrow implements ITaskEscrow {
  async allocateSubtask(): Promise<string> {
    return "eval-allocate-subtask";
  }

  async releaseOrchestratorFee(): Promise<string> {
    return "eval-release-orchestrator-fee";
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
