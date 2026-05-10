import type { IWebSearchClient, SearchResult } from "../../ports/outbound/IWebSearchClient";

export class DeterministicWebSearchAdapter implements IWebSearchClient {
  async search(query: string): Promise<SearchResult[]> {
    const slug = query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);

    return [
      {
        title: "AgentMesh internal research seed",
        url: `https://docs.agentmesh.local/research/${slug || "general"}`,
        snippet: `Research seed for ${query}.`,
      },
      {
        title: "Public market overview",
        url: `https://example.com/market/${slug || "overview"}`,
        snippet: "Comparable products, risks, pricing and adoption signals should be checked.",
      },
    ];
  }
}
