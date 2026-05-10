export interface IEmbeddingClient {
  embed(text: string): Promise<number[]>;
}
