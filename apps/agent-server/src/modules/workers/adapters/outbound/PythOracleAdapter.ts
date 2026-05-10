import type { IPythOracleClient } from "../../ports/outbound/IPythOracleClient";

export class PythOracleAdapter implements IPythOracleClient {
  async getPrice(symbol: string): Promise<number> {
    if (symbol.toUpperCase() === "SOL/USD") {
      return 150;
    }

    return 1;
  }
}
