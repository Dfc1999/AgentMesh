import type { RouterDecision, Tier, WorkerResponse } from "../packages/shared-types/src/index";
import { MockConsensus } from "../apps/agent-server/src/modules/judge/adapters/outbound/__mocks__/MockConsensus";
import { MockJudgeLlm } from "../apps/agent-server/src/modules/judge/adapters/outbound/__mocks__/MockJudgeLlm";
import { MockReputationLedger } from "../apps/agent-server/src/modules/judge/adapters/outbound/__mocks__/MockReputationLedger";
import { MockRouterRetry } from "../apps/agent-server/src/modules/judge/adapters/outbound/__mocks__/MockRouterRetry";
import { MockTaskEscrow } from "../apps/agent-server/src/modules/judge/adapters/outbound/__mocks__/MockTaskEscrow";
import { JudgeService } from "../apps/agent-server/src/modules/judge/domain/JudgeService";

interface JudgeFixture {
  name: string;
  expected: "approved" | "retry" | "low_confidence";
  response: WorkerResponse;
  decision: RouterDecision;
}

const goodBriefs = [
  "Analiza el mercado EV en LATAM con oportunidades y riesgos",
  "Resume tres documentos internos en una lista de hallazgos",
  "Diseña un contrato REST para registrar agentes",
  "Evalúa alternativas de proveedores LLM y costos",
  "Propón una rúbrica para validar respuestas de workers",
  "Explica un error Redis en NestJS con causas probables",
  "Compara estrategias de consenso y tradeoffs",
  "Crea una tabla de riesgos de seguridad",
  "Describe pasos para registrar un Router Agent",
  "Sintetiza métricas de optimización de tokens",
];

const badBriefs = [
  "Analiza el mercado EV en LATAM con oportunidades y riesgos",
  "Resume tres documentos internos en una lista de hallazgos",
  "Diseña un contrato REST para registrar agentes",
  "Evalúa alternativas de proveedores LLM y costos",
  "Propón una rúbrica para validar respuestas de workers",
  "Explica un error Redis en NestJS con causas probables",
  "Compara estrategias de consenso y tradeoffs",
  "Crea una tabla de riesgos de seguridad",
  "Describe pasos para registrar un Router Agent",
  "Sintetiza métricas de optimización de tokens",
];

const fixtures: JudgeFixture[] = [
  ...goodBriefs.map((brief, index) =>
    fixture(`good-${index}`, "approved", brief, goodAnswer(brief), "medium", 2_400_000),
  ),
  ...badBriefs
    .slice(0, 5)
    .map((brief, index) =>
      fixture(
        `bad-retry-${index}`,
        "retry",
        brief,
        "TODO. No sé. Respuesta incompleta.",
        "simple",
        900_000,
      ),
    ),
  ...badBriefs
    .slice(5)
    .map((brief, index) =>
      fixture(
        `bad-low-confidence-${index}`,
        "low_confidence",
        brief,
        "N/A. No puedo responder.",
        "medium",
        0,
      ),
    ),
];

async function main() {
  const judge = new JudgeService(
    new MockJudgeLlm(),
    new MockConsensus(),
    new MockTaskEscrow(),
    new MockReputationLedger(),
    new MockRouterRetry(),
  );
  let correct = 0;
  const rows = [];

  for (const testCase of fixtures) {
    const result = await judge.evaluate(testCase.response, testCase.decision);
    const passed = result.verdict === testCase.expected;
    if (passed) {
      correct += 1;
    }
    rows.push({
      name: testCase.name,
      expected: testCase.expected,
      actual: result.verdict,
      score: result.score,
      retryTier: result.retryTier ?? "",
      passed,
    });
  }

  console.table(rows);
  const accuracy = correct / fixtures.length;
  console.log(`Judge accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${fixtures.length})`);

  if (accuracy < 0.9) {
    throw new Error("Judge eval failed: accuracy below 90%.");
  }
}

function fixture(
  name: string,
  expected: JudgeFixture["expected"],
  brief: string,
  content: string,
  tier: Tier,
  maxRetryBudget: number,
): JudgeFixture {
  return {
    name,
    expected,
    response: {
      content,
      modelId: "gemini-2.5-flash-lite",
      tier,
      tokensUsed: 420,
      costLamports: 700_000,
      originalBrief: brief,
      subtaskId: `subtask-${name}`,
      subtaskPda: `SubtaskPda-${name}`,
    },
    decision: {
      tier,
      modelId: "gemini-2.5-flash-lite",
      budgetSlice: 1_500_000,
      budgetSliceLamports: 1_500_000n,
      maxRetryBudget,
      subtaskPda: `SubtaskPda-${name}`,
      confidence: 0.8,
      reasoning: "Eval fixture router decision.",
      warnings: [],
    },
  };
}

function goodAnswer(brief: string): string {
  return [
    `Respuesta para: ${brief}.`,
    "- Cubre el objetivo principal y los criterios relevantes.",
    "- Incluye riesgos, tradeoffs y pasos accionables cuando aplica.",
    "- Indica que las cifras son aproximadas si no hay fuente exacta.",
  ].join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
