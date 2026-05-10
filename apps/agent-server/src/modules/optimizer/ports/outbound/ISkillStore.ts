import type { SkillTemplate } from "../../domain/types";

export interface SkillStoreMatch {
  skill: SkillTemplate;
  similarity: number;
}

export interface ISkillStore {
  findBestMatch(embedding: number[], threshold: number): Promise<SkillStoreMatch | null>;
  list(): Promise<SkillTemplate[]>;
}
