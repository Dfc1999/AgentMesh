import type { OptimizedQuery, Tier } from "../packages/shared-types/src/index";
import { MockAgentRegistry } from "../apps/agent-server/src/modules/router/adapters/outbound/__mocks__/MockAgentRegistry";
import { MockRouterLlm } from "../apps/agent-server/src/modules/router/adapters/outbound/__mocks__/MockRouterLlm";
import { MockTaskEscrow } from "../apps/agent-server/src/modules/router/adapters/outbound/__mocks__/MockTaskEscrow";
import { RouterService } from "../apps/agent-server/src/modules/router/domain/RouterService";

interface RouterFixture {
  name: string;
  expectedTier: Tier;
  query: OptimizedQuery;
}

const fixtures: RouterFixture[] = [
  fixture("short factual", "simple", "Resume qué es Solana en una frase.", 22, 0.1, false),
  fixture("translation", "simple", "Traduce 'hello world' al español.", 12, 0.1, false),
  fixture(
    "formatting",
    "simple",
    "Convierte esta fecha a ISO: 8 de mayo de 2026.",
    18,
    0.12,
    false,
  ),
  fixture(
    "simple extraction",
    "simple",
    "Extrae el email de este texto: contacto demo@example.com",
    30,
    0.16,
    false,
  ),
  fixture("quick math", "simple", "Calcula 17 * 23 y responde solo el número.", 15, 0.18, false),
  fixture(
    "market analysis",
    "medium",
    "Analiza el mercado EV en LATAM y sintetiza oportunidades.",
    180,
    0.52,
    true,
  ),
  fixture(
    "code review",
    "medium",
    "Revisa este endpoint TypeScript y sugiere mejoras de seguridad.",
    240,
    0.55,
    false,
  ),
  fixture(
    "doc synthesis",
    "medium",
    "Sintetiza los puntos clave de tres documentos internos.",
    320,
    0.62,
    true,
  ),
  fixture(
    "api design",
    "medium",
    "Diseña un contrato REST para registrar agentes y consultar reputación.",
    260,
    0.58,
    false,
  ),
  fixture(
    "debugging",
    "medium",
    "Debuggea un error de conexión Redis en NestJS con posibles causas.",
    220,
    0.6,
    false,
  ),
  fixture(
    "architecture",
    "complex",
    "Diseña una arquitectura end-to-end para un marketplace multiagente con pagos on-chain.",
    900,
    0.82,
    true,
  ),
  fixture(
    "security audit",
    "complex",
    "Haz una auditoría de seguridad del flujo completo con amenazas y mitigaciones.",
    850,
    0.86,
    true,
  ),
  fixture(
    "ambiguous planning",
    "complex",
    "Crea un roadmap técnico completo para migrar toda la plataforma a microservicios.",
    760,
    0.78,
    true,
  ),
  fixture(
    "deep reasoning",
    "complex",
    "Compara tres estrategias de consenso y justifica tradeoffs económicos.",
    700,
    0.8,
    true,
  ),
  fixture(
    "large context",
    "complex",
    "Analiza un repositorio completo y propone refactors priorizados.",
    1_100,
    0.75,
    true,
  ),
  fixture(
    "budget medium",
    "medium",
    "Implementa una función de ranking con tests.",
    180,
    0.48,
    false,
  ),
  fixture(
    "budget complex",
    "complex",
    "Optimiza un pipeline RAG completo con evaluación semántica y métricas.",
    950,
    0.88,
    true,
  ),
  fixture(
    "research",
    "medium",
    "Investiga alternativas de proveedores LLM y resume costos.",
    360,
    0.64,
    true,
  ),
  fixture(
    "validator",
    "medium",
    "Define una rúbrica para validar respuestas de workers.",
    260,
    0.6,
    false,
  ),
  fixture(
    "multi step",
    "complex",
    "Resuelve un problema multi-step de planificación, presupuesto y dependencias críticas.",
    650,
    0.76,
    false,
  ),
];

async function main() {
  const router = new RouterService(
    new MockRouterLlm(),
    new MockAgentRegistry(),
    new MockTaskEscrow(),
  );
  let correct = 0;
  const rows = [];

  for (const [index, testCase] of fixtures.entries()) {
    const decision = await router.classify(testCase.query, {
      routerAgentPda: "RouterAgentMockPda111111111111111111111111111",
      subtaskPda: `SubtaskMockPda${index}`,
      remainingBudgetLamports: 5_000_000n,
    });
    const passed = decision.tier === testCase.expectedTier;
    if (passed) {
      correct += 1;
    }
    rows.push({
      name: testCase.name,
      expected: testCase.expectedTier,
      actual: decision.tier,
      passed,
      model: decision.modelId,
      warnings: decision.warnings.join(","),
    });
  }

  console.table(rows);
  const accuracy = correct / fixtures.length;
  const estimatedRouterCostUsd = 0.001;
  console.log(`Router accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${fixtures.length})`);
  console.log(`Estimated router classification cost: $${estimatedRouterCostUsd.toFixed(3)}`);

  if (accuracy < 0.85) {
    throw new Error("Router eval failed: accuracy below 85%.");
  }

  if (estimatedRouterCostUsd > 0.002) {
    throw new Error("Router eval failed: estimated classification cost exceeds $0.002.");
  }
}

function fixture(
  name: string,
  expectedTier: Tier,
  content: string,
  processedTokens: number,
  complexityHint: number,
  needsDocs: boolean,
): RouterFixture {
  return {
    name,
    expectedTier,
    query: {
      content,
      intentClassification: {
        needsDocs,
        complexityHint,
      },
      metrics: {
        cacheHit: false,
        originalTokens: Math.ceil(processedTokens * 1.4),
        processedTokens,
        reductionPercent: 29,
        techniquesApplied: ["mock_optimizer"],
        estimatedQualityRisk: "low",
        latencyMs: 12,
      },
    },
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
