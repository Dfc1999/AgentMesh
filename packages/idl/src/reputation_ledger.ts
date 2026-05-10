export type ReputationLedger = {
  version: "0.1.0";
  name: "reputation_ledger";
  instructions: ["record_outcome", "record_tier_accuracy", "query_score", "export_credential"];
  accounts: {
    reputationAccount: ReputationAccount;
  };
  types: {
    outcomeEntry: OutcomeEntry;
    reputationCredential: ReputationCredential;
    tier: Tier;
  };
};

export type Tier = "simple" | "medium" | "complex";

export interface OutcomeEntry {
  task: string;
  score: number;
  success: boolean;
  tierUsed: Tier;
  recordedAt: bigint;
  sequence: number;
}

export interface ReputationAccount {
  agent: string;
  reputationScore: number;
  totalOutcomes: number;
  successfulOutcomes: number;
  totalTierPredictions: number;
  accurateTierPredictions: number;
  outcomes: OutcomeEntry[];
  bump: number;
}

export interface ReputationCredential {
  agent: string;
  reputationScore: number;
  totalOutcomes: number;
  successfulOutcomes: number;
  totalTierPredictions: number;
  accurateTierPredictions: number;
  exportedAt: bigint;
}

export const REPUTATION_LEDGER_PROGRAM_ID = "11111111111111111111111111111111";

export const REPUTATION_LEDGER_IDL: ReputationLedger = {
  version: "0.1.0",
  name: "reputation_ledger",
  instructions: ["record_outcome", "record_tier_accuracy", "query_score", "export_credential"],
  accounts: {
    reputationAccount: {
      agent: "",
      reputationScore: 0,
      totalOutcomes: 0,
      successfulOutcomes: 0,
      totalTierPredictions: 0,
      accurateTierPredictions: 0,
      outcomes: [],
      bump: 0,
    },
  },
  types: {
    outcomeEntry: {
      task: "",
      score: 0,
      success: false,
      tierUsed: "simple",
      recordedAt: 0n,
      sequence: 0,
    },
    reputationCredential: {
      agent: "",
      reputationScore: 0,
      totalOutcomes: 0,
      successfulOutcomes: 0,
      totalTierPredictions: 0,
      accurateTierPredictions: 0,
      exportedAt: 0n,
    },
    tier: "simple",
  },
};

export const IDL = REPUTATION_LEDGER_IDL;
