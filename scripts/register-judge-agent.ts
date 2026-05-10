import { createMockSolanaProgramClients } from "../apps/agent-server/src/shared/solana/programs";

const JUDGING_CAPABILITY = 1n << 5n;

async function main() {
  const clients = createMockSolanaProgramClients();
  const tx = await clients.agentRegistry.registerAgent({
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

  console.log("Judge Agent registration prepared.");
  console.log(`signature: ${tx.signature}`);
  console.log(
    "Replace createMockSolanaProgramClients with the generated Anchor client before Devnet registration.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
