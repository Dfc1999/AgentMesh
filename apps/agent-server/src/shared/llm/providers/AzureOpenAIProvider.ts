import { AzureOpenAI } from "openai";
import type { CompletionRequest, CompletionResponse, ModelId } from "@agentmesh/shared-types";
import { BaseProvider } from "./BaseProvider";

type AzureDeploymentMap = Partial<Record<ModelId, string>>;

export class AzureOpenAIProvider extends BaseProvider {
  private readonly client: AzureOpenAI;

  constructor(
    config: {
      apiKey: string;
      endpoint: string;
      apiVersion: string;
    },
    private readonly deployments: AzureDeploymentMap,
  ) {
    super(150);
    this.client = new AzureOpenAI({
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      apiVersion: config.apiVersion,
    });
  }

  protected async doComplete(req: CompletionRequest): Promise<CompletionResponse> {
    const startedAt = Date.now();
    const deployment = this.deployments[req.model];
    if (!deployment) {
      throw new Error(`Azure OpenAI deployment is not configured for model ${req.model}.`);
    }

    const response = await this.client.chat.completions.create({
      model: deployment,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      messages: [
        ...(req.systemPrompt ? [{ role: "system" as const, content: req.systemPrompt }] : []),
        ...req.messages.map((message) => ({ role: message.role, content: message.content })),
      ] as never,
    });

    return {
      content: response.choices[0]?.message.content?.trim() ?? "",
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      cachedTokens: 0,
      latencyMs: Date.now() - startedAt,
      provider: "openai",
      model: req.model,
    };
  }
}
