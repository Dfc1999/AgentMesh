import type { LLMClient } from "../../../../shared/llm/types";
import type { IEmbeddingClient } from "../../ports/outbound/IEmbeddingClient";
import type { ISemanticCacheStore } from "../../ports/outbound/ISemanticCacheStore";
import type { ISkillStore } from "../../ports/outbound/ISkillStore";
import type { IVectorStore } from "../../ports/outbound/IVectorStore";
import type { OptimizerConfig, PipelineStep } from "../types";
import { ContextPruningStep } from "./ContextPruningStep";
import { IntentClassifierStep } from "./IntentClassifierStep";
import { PromptCacheStep } from "./PromptCacheStep";
import { RagSearchStep } from "./RagSearchStep";
import { SemanticCacheStep } from "./SemanticCacheStep";
import { SkillMatcherStep } from "./SkillMatcherStep";

export function createOptimizerPipeline(deps: {
  embedder: IEmbeddingClient;
  cache: ISemanticCacheStore;
  skillStore: ISkillStore;
  vectorStore: IVectorStore;
  llm: LLMClient;
  config: OptimizerConfig;
}): PipelineStep[] {
  const steps: PipelineStep[] = [
    new SemanticCacheStep(deps.embedder, deps.cache, deps.config),
  ];

  if (deps.config.featureFlags.intentClassifier) {
    steps.push(new IntentClassifierStep(deps.llm));
  }

  steps.push(
    new SkillMatcherStep(deps.embedder, deps.skillStore, deps.config),
    new RagSearchStep(deps.vectorStore, deps.config),
    new ContextPruningStep(deps.embedder, deps.config),
    new PromptCacheStep(deps.config),
  );

  return steps;
}
