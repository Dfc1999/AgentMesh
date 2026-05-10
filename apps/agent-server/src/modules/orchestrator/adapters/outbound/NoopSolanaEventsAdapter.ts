import type {
  ISolanaEvents,
  SolanaSubtaskEvent,
  Unsubscribe,
} from "../../ports/outbound/ISolanaEvents";

export class NoopSolanaEventsAdapter implements ISolanaEvents {
  private readonly handlers = new Set<(event: SolanaSubtaskEvent) => void>();

  subscribeToSubtaskEvents(handler: (event: SolanaSubtaskEvent) => void): Unsubscribe {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emitForLocalQa(event: SolanaSubtaskEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
