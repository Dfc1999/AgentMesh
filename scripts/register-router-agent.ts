import { createMockSolanaProgramClients } from "../apps/agent-server/src/shared/solana/programs";

const ROUTING_CAPABILITY = 1n << 4n;

async function main() {
  const clients = createMockSolanaProgramClients();
  const tx = await clients.agentRegistry.registerAgent({
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

  console.log("Router Agent registration prepared.");
  console.log(`signature: ${tx.signature}`);
  console.log(
    "Replace createMockSolanaProgramClients with the generated Anchor client before Devnet registration.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
