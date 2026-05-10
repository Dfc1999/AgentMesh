import { BaseWorkerService } from "../base/BaseWorkerService";
import { WORKER_CAPABILITIES, type StructuredWorkerOutput, type SubtaskContext } from "../base/types";
import type { IJupiterClient } from "../../ports/outbound/IJupiterClient";
import type { IPythOracleClient } from "../../ports/outbound/IPythOracleClient";
import type { ITaskEscrow } from "../../ports/outbound/ITaskEscrow";

const MAX_PRICE_IMPACT_PCT = 1;

export class ExecutorService extends BaseWorkerService {
  readonly kind = "executor" as const;
  readonly agentPda = "ExecutorAgentLocal";

  constructor(
    taskEscrow: ITaskEscrow,
    private readonly pyth: IPythOracleClient,
    private readonly jupiter: IJupiterClient,
  ) {
    super(
      WORKER_CAPABILITIES.EXECUTION | WORKER_CAPABILITIES.DEFI | WORKER_CAPABILITIES.SWAP,
      taskEscrow,
    );
  }

  protected async perform(subtask: SubtaskContext): Promise<StructuredWorkerOutput> {
    const solPrice = await this.pyth.getPrice("SOL/USD");
    const quote = await this.jupiter.getSwapQuote({
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: "USDC111111111111111111111111111111111111111",
      amount: subtask.budgetLamports / 10n,
      slippageBps: 50,
    });
    const simulation = await this.jupiter.simulateSwap?.(quote);

    if (quote.priceImpactPct > MAX_PRICE_IMPACT_PCT) {
      throw new Error(`Swap aborted: price impact ${quote.priceImpactPct}% exceeds limit.`);
    }
    if (simulation && !simulation.ok) {
      throw new Error(`Swap aborted: simulation failed: ${simulation.reason ?? "unknown"}.`);
    }

    return {
      summary:
        "Executor completed pre-execution DeFi validation and simulation. No live swap was sent without explicit consensus approval.",
      keyFindings: [
        `SOL/USD reference price: ${solPrice}`,
        `Quote output amount: ${quote.outAmount.toString()}`,
        `Price impact: ${quote.priceImpactPct}%`,
        "Consensus approval is required before broadcasting any real DeFi transaction.",
      ],
      rawData: { quote, simulation },
      confidence: 0.82,
    };
  }
}
