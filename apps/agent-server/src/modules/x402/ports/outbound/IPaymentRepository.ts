import type { MicropaymentRecord } from "../../domain/types";

export interface IPaymentRepository {
  recordPayment(record: MicropaymentRecord): Promise<void>;
  listPayments(agentId?: string): Promise<MicropaymentRecord[]>;
}
