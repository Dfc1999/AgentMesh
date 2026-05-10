import type { MicropaymentRecord } from "../../domain/types";
import type { IPaymentRepository } from "../../ports/outbound/IPaymentRepository";

export class InMemoryPaymentRepository implements IPaymentRepository {
  private readonly records: MicropaymentRecord[] = [];

  async recordPayment(record: MicropaymentRecord): Promise<void> {
    this.records.push(record);
  }

  async listPayments(agentId?: string): Promise<MicropaymentRecord[]> {
    return agentId
      ? this.records.filter((record) => record.agentId === agentId)
      : [...this.records];
  }
}
