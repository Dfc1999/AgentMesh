export interface SolanaSubtaskEvent {
  type: "SubtaskCompleted" | "TimeoutClaimed" | "SubtaskRetried";
  taskPda: string;
  subtaskPda: string;
  signature: string;
  slot?: number;
}

export type Unsubscribe = () => void;

export interface ISolanaEvents {
  subscribeToSubtaskEvents(handler: (event: SolanaSubtaskEvent) => void): Unsubscribe;
}
