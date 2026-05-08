export interface SolanaConnectionConfig {
  rpcUrl: string;
  wsUrl: string;
}

export class ConnectionPool {
  constructor(readonly config: SolanaConnectionConfig) {}
}
