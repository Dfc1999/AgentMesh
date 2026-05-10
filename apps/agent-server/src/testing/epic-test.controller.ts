import { Body, Controller, Post } from "@nestjs/common";
import type { OptimizedQuery, RouterDecision, WorkerResponse } from "@agentmesh/shared-types";
import { MockJudgeLlm } from "../modules/judge/adapters/outbound/__mocks__/MockJudgeLlm";
import { MockConsensus } from "../modules/judge/adapters/outbound/__mocks__/MockConsensus";
import { MockReputationLedger } from "../modules/judge/adapters/outbound/__mocks__/MockReputationLedger";
import { MockRouterRetry } from "../modules/judge/adapters/outbound/__mocks__/MockRouterRetry";
import { MockTaskEscrow as MockJudgeTaskEscrow } from "../modules/judge/adapters/outbound/__mocks__/MockTaskEscrow";
import { JudgeService } from "../modules/judge/domain/JudgeService";
import { MockAgentRegistry } from "../modules/router/adapters/outbound/__mocks__/MockAgentRegistry";
import { MockRouterLlm } from "../modules/router/adapters/outbound/__mocks__/MockRouterLlm";
import { MockTaskEscrow as MockRouterTaskEscrow } from "../modules/router/adapters/outbound/__mocks__/MockTaskEscrow";
import { RouterService } from "../modules/router/domain/RouterService";
import type { EscrowContext } from "../modules/router/domain/types";

interface RouterQaBody {
  query?: Partial<OptimizedQuery>;
  escrowCtx?: Partial<SerializedEscrowContext>;
}

interface JudgeQaBody {
  response?: Partial<WorkerResponse>;
  decision?: Partial<SerializedRouterDecision>;
}

interface FlowQaBody extends RouterQaBody {
  workerResponse?: Partial<WorkerResponse>;
}

interface SerializedEscrowContext {
  routerAgentPda: string;
  subtaskPda: string;
  remainingBudgetLamports: string | number;
  maxRetryBudgetLamports?: string | number;
}

type SerializedRouterDecision = Omit<RouterDecision, "budgetSliceLamports"> & {
  budgetSliceLamports: string | number;
};

@Controller("qa")
export class EpicTestController {
  private readonly router = new RouterService(
    new MockRouterLlm(),
    new MockAgentRegistry(),
    new MockRouterTaskEscrow(),
  );

  private readonly judge = new JudgeService(
    new MockJudgeLlm(),
    new MockConsensus(),
    new MockJudgeTaskEscrow(),
    new MockReputationLedger(),
    new MockRouterRetry(),
  );

  @Post("epic04/router/classify")
  async classify(@Body() body: RouterQaBody) {
    const decision = await this.router.classify(
      buildQuery(body.query),
      buildEscrow(body.escrowCtx),
    );
    return {
      ok: true,
      epic: "04",
      decision: serializeRouterDecision(decision),
    };
  }

  @Post("epic05/judge/evaluate")
  async evaluate(@Body() body: JudgeQaBody) {
    const decision = deserializeRouterDecision(body.decision);
    const response = buildWorkerResponse(body.response, decision);
    const result = await this.judge.evaluate(response, decision);

    return {
      ok: true,
      epic: "05",
      result,
    };
  }

  @Post("epic04-05/flow")
  async flow(@Body() body: FlowQaBody) {
    const query = buildQuery(body.query);
    const decision = await this.router.classify(query, buildEscrow(body.escrowCtx));
    const response = buildWorkerResponse(
      {
        originalBrief: query.content,
        subtaskPda: decision.subtaskPda,
        tier: decision.tier,
        modelId: decision.modelId,
        ...body.workerResponse,
      },
      decision,
    );
    const result = await this.judge.evaluate(response, decision);

    return {
      ok: true,
      epic: "04-05",
      decision: serializeRouterDecision(decision),
      result,
    };
  }
}

function buildQuery(overrides: Partial<OptimizedQuery> = {}): OptimizedQuery {
  return {
    content:
      overrides.content ??
      "Genera una lista de pasos para registrar un Router Agent y validar que declare el tier correcto.",
    intentClassification: {
      needsDocs: false,
      complexityHint: 0.42,
      ...overrides.intentClassification,
    },
    metrics: {
      cacheHit: false,
      originalTokens: 120,
      processedTokens: 90,
      reductionPercent: 25,
      techniquesApplied: ["trim"],
      estimatedQualityRisk: "low",
      latencyMs: 12,
      ...overrides.metrics,
    },
    cachedResponse: overrides.cachedResponse,
    contextChunks: overrides.contextChunks,
  };
}

function buildEscrow(overrides: Partial<SerializedEscrowContext> = {}): EscrowContext {
  return {
    routerAgentPda: overrides.routerAgentPda ?? "RouterAgentMockPda111111111111111111111111111",
    subtaskPda: overrides.subtaskPda ?? "SubtaskMockPda111111111111111111111111111111",
    remainingBudgetLamports: toBigInt(overrides.remainingBudgetLamports ?? 6_000_000),
    maxRetryBudgetLamports:
      overrides.maxRetryBudgetLamports === undefined
        ? 3_000_000n
        : toBigInt(overrides.maxRetryBudgetLamports),
  };
}

function buildWorkerResponse(
  overrides: Partial<WorkerResponse> = {},
  decision: RouterDecision,
): WorkerResponse {
  return {
    content:
      "1. Registrar el agente en Agent Registry. 2. Leer routing rules. 3. Declarar el tier en Task Escrow. 4. Enviar al worker elegido.",
    modelId: decision.modelId,
    tier: decision.tier,
    tokensUsed: 180,
    costLamports: 700_000,
    originalBrief:
      "Genera una lista de pasos para registrar un Router Agent y validar que declare el tier correcto.",
    subtaskId: "subtask-postman-001",
    subtaskPda: decision.subtaskPda,
    retryCount: 0,
    ...overrides,
  };
}

function deserializeRouterDecision(
  overrides: Partial<SerializedRouterDecision> = {},
): RouterDecision {
  return {
    tier: overrides.tier ?? "simple",
    modelId: overrides.modelId ?? "gemini-2.5-flash-lite",
    budgetSlice: Number(overrides.budgetSlice ?? 1_200_000),
    budgetSliceLamports: toBigInt(overrides.budgetSliceLamports ?? 1_200_000),
    maxRetryBudget: Number(overrides.maxRetryBudget ?? 3_000_000),
    subtaskPda: overrides.subtaskPda ?? "SubtaskMockPda111111111111111111111111111111",
    confidence: Number(overrides.confidence ?? 0.82),
    reasoning: overrides.reasoning ?? "Mock Router decision for Postman QA.",
    warnings: overrides.warnings ?? [],
    declareTierSignature: overrides.declareTierSignature,
    cachedResponse: overrides.cachedResponse,
  };
}

function serializeRouterDecision(decision: RouterDecision): SerializedRouterDecision {
  return {
    ...decision,
    budgetSliceLamports: decision.budgetSliceLamports.toString(),
  };
}

function toBigInt(value: string | number): bigint {
  return BigInt(value);
}
