export interface AgentMeshClientConfig {
  rpcUrl: string;
  apiBaseUrl?: string;
}

export class AgentMeshClient {
  constructor(private readonly config: AgentMeshClientConfig) {}

  get rpcUrl(): string {
    return this.config.rpcUrl;
  }
}
