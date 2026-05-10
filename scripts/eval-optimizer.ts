import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DeterministicEmbeddingAdapter } from "../apps/agent-server/src/modules/optimizer/adapters/outbound/DeterministicEmbeddingAdapter";
import { HeuristicLLMAdapter } from "../apps/agent-server/src/modules/optimizer/adapters/outbound/HeuristicLLMAdapter";
import { InMemorySemanticCacheAdapter } from "../apps/agent-server/src/modules/optimizer/adapters/outbound/InMemorySemanticCacheAdapter";
import { InMemorySkillStore } from "../apps/agent-server/src/modules/optimizer/adapters/outbound/InMemorySkillStore";
import { InMemoryVectorStore } from "../apps/agent-server/src/modules/optimizer/adapters/outbound/InMemoryVectorStore";
import { OptimizerService } from "../apps/agent-server/src/modules/optimizer/domain/OptimizerService";
import { createOptimizerPipeline } from "../apps/agent-server/src/modules/optimizer/domain/pipeline/PipelineComposer";
import type {
  OptimizerConfig,
  OptimizerEvaluationReport,
  OptimizerFeatureFlags,
  OptimizerTechnique,
} from "../apps/agent-server/src/modules/optimizer/domain/types";
import { cosineSimilarity } from "../apps/agent-server/src/modules/optimizer/domain/utils";

const FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/representative-queries.json");
const SAFETY_THRESHOLD = 0.95;

const techniques: Array<[OptimizerTechnique, keyof OptimizerFeatureFlags]> = [
  ["semantic_cache", "semanticCache"],
  ["intent_classifier", "intentClassifier"],
  ["skill_match_partial", "skillMatching"],
  ["rag_search", "ragSearch"],
  ["context_pruning", "contextPruning"],
  ["prompt_cache", "promptCache"],
];

async function main() {
  const queries = await loadQueries();
  const embedder = new DeterministicEmbeddingAdapter();
  const baseline = createOptimizer(defaultFlags());
  const baselineOutputs = await Promise.all(queries.map((query) => baseline.run(query)));

  const report: OptimizerEvaluationReport = {
    totalQueries: queries.length,
    threshold: SAFETY_THRESHOLD,
    techniques: [],
  };

  for (const [technique, flag] of techniques) {
    const variantFlags = defaultFlags();
    variantFlags[flag] = false;
    const variant = createOptimizer(variantFlags);
    const similarities: number[] = [];

    for (let i = 0; i < queries.length; i += 1) {
      const output = await variant.run(queries[i]);
      const [baselineEmbedding, variantEmbedding] = await Promise.all([
        embedder.embed(baselineOutputs[i].content),
        embedder.embed(output.content),
      ]);
      similarities.push(cosineSimilarity(baselineEmbedding, variantEmbedding));
    }

    const avgSimilarity =
      similarities.reduce((sum, similarity) => sum + similarity, 0) / similarities.length;
    const minSimilarity = Math.min(...similarities);

    report.techniques.push({
      technique,
      avgSimilarity: round(avgSimilarity),
      minSimilarity: round(minSimilarity),
      safe: minSimilarity >= SAFETY_THRESHOLD,
    });
  }

  console.log(JSON.stringify(report, null, 2));

  if (report.techniques.some((item) => !item.safe)) {
    process.exitCode = 1;
  }
}

function createOptimizer(flags: OptimizerFeatureFlags) {
  const embedder = new DeterministicEmbeddingAdapter();
  const cache = new InMemorySemanticCacheAdapter();
  const skillStore = new InMemorySkillStore(embedder);
  const vectorStore = new InMemoryVectorStore(embedder);
  const llm = new HeuristicLLMAdapter();
  const config = createConfig(flags);
  const pipeline = createOptimizerPipeline({
    embedder,
    cache,
    skillStore,
    vectorStore,
    llm,
    config,
  });

  return new OptimizerService(pipeline, cache, config);
}

function createConfig(featureFlags: OptimizerFeatureFlags): OptimizerConfig {
  return {
    semanticCacheThreshold: 0.97,
    skillExactThreshold: 0.98,
    skillPartialThreshold: 0.95,
    ragTopK: 5,
    ragMinScore: 0.7,
    pruningDuplicateThreshold: 0.9,
    pruningMinRelevance: 0.3,
    defaultCacheTtlSeconds: 3600,
    defiCacheTtlSeconds: 300,
    featureFlags,
  };
}

function defaultFlags(): OptimizerFeatureFlags {
  return {
    semanticCache: true,
    intentClassifier: true,
    skillMatching: true,
    ragSearch: true,
    contextPruning: true,
    promptCache: true,
  };
}

async function loadQueries(): Promise<string[]> {
  const raw = await readFile(FIXTURE_PATH, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error(`${FIXTURE_PATH} must contain a JSON array of strings`);
  }

  if (parsed.length === 0) {
    throw new Error(`${FIXTURE_PATH} must include at least one query`);
  }

  return parsed;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
