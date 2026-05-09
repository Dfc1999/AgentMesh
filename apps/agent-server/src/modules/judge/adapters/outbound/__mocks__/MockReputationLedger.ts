import type {
  IReputationLedger,
  RecordTierAccuracyInput,
} from "../../../ports/outbound/IReputationLedger";

export class MockReputationLedger implements IReputationLedger {
  readonly records: RecordTierAccuracyInput[] = [];

  async recordTierAccuracy(input: RecordTierAccuracyInput): Promise<string> {
    this.records.push(input);
    return `mockTierAccuracy_${input.predictedTier}_${input.actualTierNeeded}`;
  }
}
