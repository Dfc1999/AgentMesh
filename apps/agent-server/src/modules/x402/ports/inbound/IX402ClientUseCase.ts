import type { X402PaymentRequest, X402PaymentResult } from "../../domain/types";

export interface IX402ClientUseCase {
  fetchWithPayment(request: X402PaymentRequest): Promise<X402PaymentResult>;
}
