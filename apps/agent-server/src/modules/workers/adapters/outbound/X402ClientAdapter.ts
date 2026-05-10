import type { IX402Client, X402FetchResult } from "../../ports/outbound/IX402Client";

export class X402ClientAdapter implements IX402Client {
  async fetch(url: string): Promise<X402FetchResult> {
    return {
      url,
      status: 200,
      body: "x402 payment client placeholder response. EPIC-08 will replace this adapter with real paid HTTP requests.",
      paymentSignature: "pending_x402_epic08",
    };
  }
}
