import type {
  IReputationLedger,
  RecordTierAccuracyInput,
} from "../../ports/outbound/IReputationLedger";

export class SolanaReputationLedgerAdapter implements IReputationLedger {
  async recordTierAccuracy(input: RecordTierAccuracyInput): Promise<string> {
    return `pending_reputation_tier_accuracy_${input.routerAgent}_${input.predictedTier}_${input.actualTierNeeded}`;
  }
}
