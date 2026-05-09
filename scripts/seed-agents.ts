import { createMockSolanaProgramClients } from "../apps/agent-server/src/shared/solana/programs";

const ROUTING_CAPABILITY = 1n << 4n;
const JUDGING_CAPABILITY = 1n << 5n;

async function main() {
  const clients = createMockSolanaProgramClients();
  const router = await clients.agentRegistry.registerAgent({
    capabilities: ROUTING_CAPABILITY,
    supportedTiers: 0,
    pricePerTask: 250_000n,
    agentClass: "router",
    routingRules: {
      simpleMaxTokens: 50,
      simpleMaxComplexityBps: 3_000,
      mediumMaxTokens: 500,
      mediumMaxComplexityBps: 7_000,
      minReputationScore: -50,
      maxRetries: 1,
    },
  });
  const judge = await clients.agentRegistry.registerAgent({
    capabilities: JUDGING_CAPABILITY,
    supportedTiers: 0,
    pricePerTask: 500_000n,
    agentClass: "judge",
    routingRules: {
      simpleMaxTokens: 50,
      simpleMaxComplexityBps: 7_500,
      mediumMaxTokens: 500,
      mediumMaxComplexityBps: 7_500,
      minReputationScore: -50,
      maxRetries: 1,
    },
  });

  console.log("Seeded mock Router and Judge Agents.");
  console.log(`router registration signature: ${router.signature}`);
  console.log(`judge registration signature: ${judge.signature}`);
  console.log("Worker/Optimizer seeds remain reserved for their EPIC owners.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
