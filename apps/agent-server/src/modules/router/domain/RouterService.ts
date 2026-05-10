import type { OptimizedQuery, RouterDecision } from "@agentmesh/shared-types";
import { modelForPurpose } from "../../../shared/llm/modelSelection";
import { TierClassifier } from "./TierClassifier";
import type { IAgentRegistry } from "../ports/outbound/IAgentRegistry";
import type { IRouterLlm } from "../ports/outbound/IRouterLlm";
import type { ITaskEscrow } from "../ports/outbound/ITaskEscrow";
import type { EscrowContext, RouterClassification } from "./types";

const ROUTER_MODEL = modelForPurpose("router");

export class RouterService {
  constructor(
    private readonly llm: IRouterLlm,
    private readonly registry: IAgentRegistry,
    private readonly escrow: ITaskEscrow,
    private readonly classifier = new TierClassifier(),
  ) {}

  async classify(query: OptimizedQuery, escrowCtx: EscrowContext): Promise<RouterDecision> {
    if (query.metrics.cacheHit) {
      return this.buildCacheHitDecision(query, escrowCtx);
    }

    const skillId = query.intentClassification.skillId ?? query.intentClassification.skillMatch;
    if (skillId && this.registry.findSkillTemplate) {
      const template = await this.registry.findSkillTemplate(skillId);
      if (template && template.score >= 0.98) {
        return this.buildSkillTemplateDecision(query, escrowCtx, template.renderedTemplate);
      }
    }

    const rules = await this.registry.getRoutingRules(escrowCtx.routerAgentPda);
    const classification = await this.classifyComplexity(query, rules);
    const resolution = this.classifier.classifyWithRules(
      query,
      classification,
      rules,
      escrowCtx.remainingBudgetLamports,
      escrowCtx.maxRetryBudgetLamports,
    );

    let declareTierSignature: string | undefined;
    if (!resolution.warnings.includes("insufficient_budget")) {
      declareTierSignature = await this.escrow.declareTier({
        subtaskPda: escrowCtx.subtaskPda,
        tier: resolution.tier,
        modelId: resolution.modelId,
        budgetSliceLamports: resolution.budgetSliceLamports,
      });
    }

    return {
      tier: resolution.tier,
      modelId: resolution.modelId,
      budgetSlice: Number(resolution.budgetSliceLamports),
      budgetSliceLamports: resolution.budgetSliceLamports,
      maxRetryBudget: Number(resolution.maxRetryBudgetLamports),
      subtaskPda: escrowCtx.subtaskPda,
      confidence: classification.confidence,
      reasoning: resolution.reasoning,
      warnings: resolution.warnings,
      declareTierSignature,
    };
  }

  private async classifyComplexity(
    query: OptimizedQuery,
    rules: Awaited<ReturnType<IAgentRegistry["getRoutingRules"]>>,
  ): Promise<RouterClassification> {
    try {
      const response = await this.llm.complete({
        model: ROUTER_MODEL,
        messages: [{ role: "user", content: this.buildClassificationPrompt(query, rules) }],
        maxTokens: 200,
        temperature: 0,
        cacheSystemPrompt: true,
      });
      return parseRouterClassification(response.content);
    } catch {
      return this.classifier.estimateWithoutLlm(query);
    }
  }

  private buildClassificationPrompt(
    query: OptimizedQuery,
    rules: Awaited<ReturnType<IAgentRegistry["getRoutingRules"]>>,
  ): string {
    return [
      "You are the AgentMesh Router Agent. Classify the query and return only compact JSON.",
      'JSON schema: {"complexityScore":0..1,"tokenEstimate":number,"reasoningRequired":boolean,"contextLength":number,"confidence":0..1,"reasoning":"short"}',
      `Rules: simple complexity<=${rules.simpleMaxComplexity}, tokens<=${rules.simpleMaxTokens}; medium complexity<=${rules.mediumMaxComplexity}, tokens<=${rules.mediumMaxTokens}.`,
      `needsDocs: ${query.intentClassification.needsDocs}`,
      `complexityHint: ${query.intentClassification.complexityHint}`,
      `processedTokens: ${query.metrics.processedTokens}`,
      `qualityRisk: ${query.metrics.estimatedQualityRisk}`,
      `<query>${query.content}</query>`,
    ].join("\n");
  }

  private buildCacheHitDecision(query: OptimizedQuery, escrowCtx: EscrowContext): RouterDecision {
    return {
      tier: "simple",
      modelId: ROUTER_MODEL,
      budgetSlice: 0,
      budgetSliceLamports: 0n,
      maxRetryBudget: 0,
      subtaskPda: escrowCtx.subtaskPda,
      confidence: 1,
      reasoning:
        "Optimizer returned a cache hit; Router skipped LLM classification and on-chain tier declaration.",
      warnings: ["cache_hit"],
      cachedResponse: query.cachedResponse,
    };
  }

  private buildSkillTemplateDecision(
    _query: OptimizedQuery,
    escrowCtx: EscrowContext,
    renderedTemplate: string,
  ): RouterDecision {
    return {
      tier: "simple",
      modelId: ROUTER_MODEL,
      budgetSlice: 0,
      budgetSliceLamports: 0n,
      maxRetryBudget: 0,
      subtaskPda: escrowCtx.subtaskPda,
      confidence: 0.98,
      reasoning:
        "Agent Registry returned an exact skill template match; Router skipped worker model routing.",
      warnings: ["skill_template_match"],
      cachedResponse: renderedTemplate,
    };
  }
}

function parseRouterClassification(content: string): RouterClassification {
  const parsed = JSON.parse(content) as Partial<RouterClassification>;
  return {
    complexityScore: clampNumber(parsed.complexityScore, 0, 1, 0.5),
    tokenEstimate: Math.max(0, Math.round(Number(parsed.tokenEstimate ?? 0))),
    reasoningRequired: Boolean(parsed.reasoningRequired),
    contextLength: Math.max(0, Math.round(Number(parsed.contextLength ?? 0))),
    confidence: clampNumber(parsed.confidence, 0, 1, 0.7),
    reasoning:
      typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : "Router LLM returned a valid classification.",
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}
