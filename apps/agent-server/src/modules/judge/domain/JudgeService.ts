import { createHash } from "node:crypto";
import type {
  DimensionScores,
  JudgeResult,
  RouterDecision,
  WorkerResponse,
} from "@agentmesh/shared-types";
import { RetryPolicy } from "./RetryPolicy";
import { ScoreCalculator, normalizeDimensions } from "./ScoreCalculator";
import type { IConsensus } from "../ports/outbound/IConsensus";
import type { IJudgeLlm } from "../ports/outbound/IJudgeLlm";
import type { IReputationLedger } from "../ports/outbound/IReputationLedger";
import type { IRouterRetry } from "../ports/outbound/IRouterRetry";
import type { ITaskEscrow } from "../ports/outbound/ITaskEscrow";
import type { JudgeEvaluation } from "./types";

const JUDGE_MODEL = "claude-sonnet-4-6" as const;
const DEFAULT_ROUTER_AGENT = "RouterAgentUnknown";

export class JudgeService {
  constructor(
    private readonly llm: IJudgeLlm,
    private readonly consensus: IConsensus,
    private readonly taskEscrow: ITaskEscrow,
    private readonly reputationLedger: IReputationLedger,
    private readonly routerRetry: IRouterRetry,
    private readonly scoreCalculator = new ScoreCalculator(),
    private readonly retryPolicy = new RetryPolicy(),
  ) {}

  async evaluate(response: WorkerResponse, decision: RouterDecision): Promise<JudgeResult> {
    const evaluation = await this.evaluateQuality(response, decision);
    const retryDecision = this.retryPolicy.decide(evaluation.score, response, decision);
    const actualTierNeeded = retryDecision.retryTier ?? decision.tier;
    const tierAccuracySignature = await this.reputationLedger.recordTierAccuracy({
      routerAgent: DEFAULT_ROUTER_AGENT,
      predictedTier: decision.tier,
      actualTierNeeded,
      retryHappened: retryDecision.verdict === "retry",
    });

    if (retryDecision.verdict === "approved") {
      const consensusSignature = await this.consensus.submitValidation(
        response.subtaskPda,
        true,
        hashReasoning(evaluation.reasoning),
      );

      return {
        verdict: "approved",
        score: evaluation.score,
        dimensions: evaluation.dimensions,
        finalContent: response.content,
        tierWasAccurate: retryDecision.tierWasAccurate,
        subtaskId: response.subtaskId,
        consensusSignature,
        tierAccuracySignature,
      };
    }

    if (retryDecision.verdict === "retry" && retryDecision.retryTier) {
      const retrySignature = await this.taskEscrow.retrySubtask({
        subtaskPda: response.subtaskPda,
        newTier: retryDecision.retryTier,
      });
      await this.routerRetry.reassign({
        subtaskId: response.subtaskId,
        subtaskPda: response.subtaskPda,
        tier: retryDecision.retryTier,
      });

      return {
        verdict: "retry",
        score: evaluation.score,
        dimensions: evaluation.dimensions,
        retryTier: retryDecision.retryTier,
        tierWasAccurate: retryDecision.tierWasAccurate,
        subtaskId: response.subtaskId,
        retrySignature,
        tierAccuracySignature,
      };
    }

    return {
      verdict: "low_confidence",
      score: evaluation.score,
      dimensions: evaluation.dimensions,
      lowConfidenceReason: retryDecision.lowConfidenceReason,
      finalContent: response.content,
      tierWasAccurate: retryDecision.tierWasAccurate,
      subtaskId: response.subtaskId,
      tierAccuracySignature,
    };
  }

  private async evaluateQuality(
    response: WorkerResponse,
    decision: RouterDecision,
  ): Promise<JudgeEvaluation> {
    try {
      const llmResponse = await this.llm.complete({
        model: JUDGE_MODEL,
        messages: [{ role: "user", content: this.buildEvaluationPrompt(response, decision) }],
        maxTokens: 400,
        temperature: 0,
        cacheSystemPrompt: true,
      });
      return parseJudgeEvaluation(llmResponse.content, this.scoreCalculator);
    } catch {
      return this.evaluateWithHeuristics(response);
    }
  }

  private evaluateWithHeuristics(response: WorkerResponse): JudgeEvaluation {
    const lowerBrief = response.originalBrief.toLowerCase();
    const lowerContent = response.content.toLowerCase();
    const briefTerms = lowerBrief
      .split(/\W+/)
      .filter((term) => term.length > 4)
      .slice(0, 12);
    const matchedTerms = briefTerms.filter((term) => lowerContent.includes(term)).length;
    const termCoverage = briefTerms.length === 0 ? 0.7 : matchedTerms / briefTerms.length;
    const contentLengthRatio = Math.min(
      response.content.length / Math.max(response.originalBrief.length * 1.5, 80),
      1,
    );
    const hasContradiction = /\b(no|not)\b[\s\S]{0,30}\b(no|not)\b/i.test(response.content);
    const hasUncertainty = /\b(aproximad|puede|podría|likely|may|uncertain|estimad)/i.test(
      response.content,
    );
    const asksForStructure = /lista|tabla|json|formato|bullet|pasos|estructura/i.test(
      response.originalBrief,
    );
    const hasStructure = /(\n-|\n\d+\.|{|\|)/.test(response.content);
    const dimensions: DimensionScores = normalizeDimensions({
      completeness: termCoverage * 0.7 + contentLengthRatio * 0.3,
      consistency: hasContradiction ? 0.45 : 0.82,
      formatCompliance: asksForStructure ? (hasStructure ? 0.85 : 0.45) : 0.8,
      appropriateConfidence:
        hasUncertainty || !/dato|cifra|porcentaje|202\d/.test(response.content) ? 0.78 : 0.62,
    });

    return {
      score: this.scoreCalculator.calculate(dimensions),
      dimensions,
      reasoning:
        "Deterministic fallback Judge evaluation used because no LLM evaluation was available.",
    };
  }

  private buildEvaluationPrompt(response: WorkerResponse, decision: RouterDecision): string {
    return [
      "You are the AgentMesh Judge Agent. Evaluate the worker response against the original brief.",
      'Return only JSON: {"dimensions":{"completeness":0..1,"consistency":0..1,"formatCompliance":0..1,"appropriateConfidence":0..1},"reasoning":"short"}',
      `Router tier: ${decision.tier}`,
      `Router model: ${decision.modelId}`,
      `Router reasoning: ${decision.reasoning}`,
      `<brief>${response.originalBrief}</brief>`,
      `<worker_response>${response.content}</worker_response>`,
    ].join("\n");
  }
}

function parseJudgeEvaluation(content: string, scoreCalculator: ScoreCalculator): JudgeEvaluation {
  const parsed = JSON.parse(content) as {
    dimensions?: Partial<DimensionScores>;
    reasoning?: string;
  };
  const dimensions = normalizeDimensions(parsed.dimensions ?? {});

  return {
    dimensions,
    score: scoreCalculator.calculate(dimensions),
    reasoning:
      typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : "Judge LLM returned a valid evaluation.",
  };
}

function hashReasoning(reasoning: string): Buffer {
  return createHash("sha256").update(reasoning).digest();
}
