import type { ReputationLedgerClient } from "../../../../shared/solana/programs";
import type {
  IReputationLedger,
  RecordTierAccuracyInput,
} from "../../ports/outbound/IReputationLedger";

export class SolanaReputationLedgerAdapter implements IReputationLedger {
  constructor(private readonly reputationLedger: ReputationLedgerClient) {}

  async recordTierAccuracy(input: RecordTierAccuracyInput): Promise<string> {
    const tx = await this.reputationLedger.recordTierAccuracy(input);
    return tx.signature;
  }
}
