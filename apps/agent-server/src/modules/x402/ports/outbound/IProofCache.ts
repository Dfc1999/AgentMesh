export interface IProofCache {
  isAlreadyUsed(signature: string): Promise<boolean>;
  markUsed(signature: string, ttlSeconds: number): Promise<void>;
}
