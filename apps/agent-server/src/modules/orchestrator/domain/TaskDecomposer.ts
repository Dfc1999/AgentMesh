import type { Tier } from "@agentmesh/shared-types";
import { modelForPurpose } from "../../../shared/llm/modelSelection";
import { capabilityMaskFor, inferCapabilities } from "./capabilities";
import type { DecompositionInput, SubtaskNode, SubtaskTree } from "./types";
import type { IOrchestratorLlm } from "../ports/outbound/IOrchestratorLlm";

const DECOMPOSER_MODEL = modelForPurpose("orchestrator_decomposer");

export class TaskDecomposer {
  constructor(private readonly llm: IOrchestratorLlm) {}

  async decompose(input: DecompositionInput): Promise<SubtaskTree> {
    const availableBudget = input.task.budgetLamports - input.orchestratorFeeLamports;
    const tree = await this.decomposeWithLlm(input).catch(() =>
      this.decomposeWithHeuristics(input, availableBudget),
    );
    const normalized = this.normalizeTree(tree, availableBudget);
    assertAcyclic(normalized);
    return normalized;
  }

  private async decomposeWithLlm(input: DecompositionInput): Promise<SubtaskTree> {
    const response = await this.llm.complete({
      model: DECOMPOSER_MODEL,
      messages: [{ role: "user", content: buildPrompt(input) }],
      maxTokens: 900,
      temperature: 0,
      cacheSystemPrompt: true,
    });
    const parsed = JSON.parse(response.content) as {
      subtasks?: Array<{
        id?: string;
        description?: string;
        dependencies?: string[];
        estimatedTier?: Tier;
        estimatedBudgetLamports?: number | string;
        requiredCapabilities?: string[];
        agentClass?: string;
      }>;
    };

    return {
      subtasks: (parsed.subtasks ?? []).map((subtask, index) =>
        this.toSubtaskNode(subtask, index, input.task.budgetLamports),
      ),
    };
  }

  private decomposeWithHeuristics(input: DecompositionInput, availableBudget: bigint): SubtaskTree {
    const text = input.optimizedBrief.content;
    const complexity = input.optimizedBrief.intentClassification.complexityHint;
    const desiredCount = complexity > 0.72 || text.length > 900 ? 5 : complexity > 0.38 ? 3 : 1;
    const segments = splitBrief(text, desiredCount);
    const perSubtask = availableBudget / BigInt(Math.max(segments.length, 1));

    return {
      subtasks: segments.map((description, index) => {
        const capabilities = inferCapabilities(description);
        return {
          id: `subtask-${index + 1}`,
          index,
          description,
          dependencies: index === 0 ? [] : [`subtask-${index}`],
          estimatedTier: estimateTier(description, complexity),
          estimatedBudgetLamports: perSubtask,
          maxRetryBudgetLamports: perSubtask / 3n,
          requiredCapabilities: capabilities,
          capabilityMask: capabilityMaskFor(capabilities),
          agentClass: "worker",
          parentSubtaskId: index === 0 ? undefined : `subtask-${index}`,
        };
      }),
    };
  }

  private normalizeTree(tree: SubtaskTree, availableBudget: bigint): SubtaskTree {
    if (tree.subtasks.length === 0) {
      throw new Error("Task decomposition returned no subtasks.");
    }

    const total = tree.subtasks.reduce((sum, subtask) => sum + subtask.estimatedBudgetLamports, 0n);
    const scaleBudget = total > availableBudget && total > 0n;

    return {
      subtasks: tree.subtasks.map((subtask, index) => {
        const budget = scaleBudget
          ? (subtask.estimatedBudgetLamports * availableBudget) / total
          : subtask.estimatedBudgetLamports;
        const capabilities =
          subtask.requiredCapabilities.length > 0
            ? subtask.requiredCapabilities
            : inferCapabilities(subtask.description);

        return {
          ...subtask,
          index,
          id: subtask.id || `subtask-${index + 1}`,
          estimatedBudgetLamports:
            budget > 0n ? budget : availableBudget / BigInt(tree.subtasks.length),
          maxRetryBudgetLamports:
            subtask.maxRetryBudgetLamports > 0n ? subtask.maxRetryBudgetLamports : budget / 3n,
          requiredCapabilities: capabilities,
          capabilityMask: capabilityMaskFor(capabilities),
        };
      }),
    };
  }

  private toSubtaskNode(
    subtask: {
      id?: string;
      description?: string;
      dependencies?: string[];
      estimatedTier?: Tier;
      estimatedBudgetLamports?: number | string;
      requiredCapabilities?: string[];
      agentClass?: string;
    },
    index: number,
    totalBudget: bigint,
  ): SubtaskNode {
    const description = subtask.description?.trim() || `Execute task step ${index + 1}`;
    const capabilities = subtask.requiredCapabilities?.length
      ? subtask.requiredCapabilities
      : inferCapabilities(description);
    const budget = BigInt(Math.max(0, Number(subtask.estimatedBudgetLamports ?? 0)));

    return {
      id: subtask.id?.trim() || `subtask-${index + 1}`,
      index,
      description,
      dependencies: subtask.dependencies ?? [],
      estimatedTier: subtask.estimatedTier ?? estimateTier(description, 0.5),
      estimatedBudgetLamports: budget > 0n ? budget : totalBudget / 3n,
      maxRetryBudgetLamports: budget > 0n ? budget / 3n : totalBudget / 10n,
      requiredCapabilities: capabilities,
      capabilityMask: capabilityMaskFor(capabilities),
      agentClass: subtask.agentClass === "validator" ? "validator" : "worker",
      parentSubtaskId: subtask.dependencies?.[0],
    };
  }
}

function buildPrompt(input: DecompositionInput): string {
  return [
    "You are the AgentMesh Orchestrator Agent. Decompose the task into a valid DAG of subtasks.",
    "Return only JSON with subtasks array. Use ids subtask-1, subtask-2, etc.",
    "Each subtask needs: id, description, dependencies, estimatedTier, estimatedBudgetLamports, requiredCapabilities, agentClass.",
    "Valid tiers: simple, medium, complex. Valid agentClass: worker or validator.",
    `Total budget lamports after orchestrator fee: ${input.task.budgetLamports - input.orchestratorFeeLamports}`,
    `Optimizer techniques: ${input.optimizedBrief.metrics.techniquesApplied.join(", ")}`,
    `<brief>${input.optimizedBrief.content}</brief>`,
  ].join("\n");
}

function splitBrief(brief: string, count: number): string[] {
  if (count === 1) {
    return [brief];
  }

  const sentences = brief
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length >= count) {
    return Array.from({ length: count }, (_, index) =>
      sentences.filter((_, sentenceIndex) => sentenceIndex % count === index).join(" "),
    ).filter(Boolean);
  }

  return Array.from({ length: count }, (_, index) => `${brief} (step ${index + 1})`);
}

function estimateTier(description: string, complexityHint: number): Tier {
  const text = description.toLowerCase();
  if (complexityHint > 0.74 || /arquitectura|security|auditor|multi|complex|consenso/.test(text)) {
    return "complex";
  }
  if (complexityHint > 0.36 || /analiza|research|compara|disena|implement/.test(text)) {
    return "medium";
  }
  return "simple";
}

function assertAcyclic(tree: SubtaskTree): void {
  const ids = new Set(tree.subtasks.map((subtask) => subtask.id));
  for (const subtask of tree.subtasks) {
    for (const dependency of subtask.dependencies) {
      if (!ids.has(dependency)) {
        throw new Error(`Subtask ${subtask.id} depends on unknown subtask ${dependency}.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(tree.subtasks.map((subtask) => [subtask.id, subtask]));

  const visit = (id: string) => {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      throw new Error(`Cycle detected in subtask tree at ${id}.`);
    }
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) {
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const subtask of tree.subtasks) {
    visit(subtask.id);
  }
}
