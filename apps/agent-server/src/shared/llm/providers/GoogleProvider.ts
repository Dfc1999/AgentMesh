import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";
import { BaseProvider } from "./BaseProvider";

export class GoogleProvider extends BaseProvider {
  private readonly client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    super(150);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  protected async doComplete(req: CompletionRequest): Promise<CompletionResponse> {
    const startedAt = Date.now();
    const model = this.client.getGenerativeModel({
      model: req.model,
      systemInstruction: req.systemPrompt,
    });
    const prompt = req.messages.map((message) => `${message.role}: ${message.content}`).join("\n");
    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: req.maxTokens,
        temperature: req.temperature,
      },
    });

    return {
      content: response.response.text().trim(),
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      latencyMs: Date.now() - startedAt,
      provider: "google",
      model: req.model,
    };
  }
}
