import type { IEmbeddingClient } from "../../ports/outbound/IEmbeddingClient";
import type { ISkillStore, SkillStoreMatch } from "../../ports/outbound/ISkillStore";
import type { SkillTemplate } from "../../domain/types";
import { cosineSimilarity } from "../../domain/utils";

const INITIAL_SKILLS: SkillTemplate[] = [
  {
    id: "market-research",
    name: "Market Research",
    capabilityMask: 0b00001,
    exampleQueries: [
      "research competitors and market size",
      "analyze a market opportunity",
      "compare competitors for a product",
    ],
    template:
      "Use the {{skill_name}} workflow. Query: {{query}}\nReturn market size, competitors, risks, sources, and recommended next actions.",
  },
  {
    id: "code-review",
    name: "Code Review",
    capabilityMask: 0b00010,
    exampleQueries: [
      "review this pull request",
      "find bugs in this code",
      "audit this implementation",
    ],
    template:
      "Use the {{skill_name}} workflow. Query: {{query}}\nPrioritize correctness bugs, regressions, security issues, and missing tests.",
  },
  {
    id: "defi-arbitrage",
    name: "DeFi Arbitrage",
    capabilityMask: 0b00100,
    exampleQueries: [
      "find defi arbitrage opportunities",
      "compare liquidity pools",
      "analyze on-chain swap routes",
    ],
    template:
      "Use the {{skill_name}} workflow. Query: {{query}}\nCheck liquidity, fees, slippage, oracle freshness, and execution risk.",
  },
  {
    id: "data-analysis",
    name: "Data Analysis",
    capabilityMask: 0b01000,
    exampleQueries: [
      "analyze this dataset",
      "find trends in csv data",
      "create insights from metrics",
    ],
    template:
      "Use the {{skill_name}} workflow. Query: {{query}}\nSummarize schema, assumptions, statistics, anomalies, and next analyses.",
  },
  {
    id: "text-summary",
    name: "Text Summary",
    capabilityMask: 0b10000,
    exampleQueries: [
      "summarize this document",
      "make a concise summary",
      "resumen del texto",
    ],
    template:
      "Use the {{skill_name}} workflow. Query: {{query}}\nProduce a concise summary, key points, decisions, and open questions.",
  },
];

interface IndexedSkill {
  skill: SkillTemplate;
  embedding: number[];
}

export class InMemorySkillStore implements ISkillStore {
  private indexed?: Promise<IndexedSkill[]>;

  constructor(
    private readonly embedder: IEmbeddingClient,
    private readonly skills: SkillTemplate[] = INITIAL_SKILLS,
  ) {}

  async findBestMatch(embedding: number[], threshold: number): Promise<SkillStoreMatch | null> {
    const indexed = await this.indexSkills();
    let best: SkillStoreMatch | null = null;

    for (const item of indexed) {
      const similarity = cosineSimilarity(embedding, item.embedding);

      if (similarity >= threshold && (!best || similarity > best.similarity)) {
        best = { skill: item.skill, similarity };
      }
    }

    return best;
  }

  async list(): Promise<SkillTemplate[]> {
    return this.skills;
  }

  private indexSkills(): Promise<IndexedSkill[]> {
    this.indexed ??= Promise.all(
      this.skills.map(async (skill) => ({
        skill,
        embedding: await this.embedder.embed(skill.exampleQueries.join(" ")),
      })),
    );

    return this.indexed;
  }
}
