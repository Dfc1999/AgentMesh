export interface IPythOracleClient {
  getPrice(symbol: string): Promise<number>;
}
