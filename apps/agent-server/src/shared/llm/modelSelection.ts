import type { ModelId, Tier } from "@agentmesh/shared-types";

export type ModelPurpose =
  | "optimizer_intent"
  | "router"
  | "judge"
  | "orchestrator_decomposer"
  | "validator"
  | `worker_${Tier}`;

export const DEFAULT_GEMINI_MODEL: ModelId = "gemini-2.5-flash-lite";

const AZURE_MODEL_BY_PURPOSE: Record<ModelPurpose, ModelId> = {
  optimizer_intent: "gpt-4.1-mini",
  router: "gpt-4.1-mini",
  judge: "gpt-4.1",
  orchestrator_decomposer: "gpt-4.1",
  validator: "gpt-4.1",
  worker_simple: "gpt-4.1-mini",
  worker_medium: "gpt-4.1",
  worker_complex: "gpt-5",
};

export function modelForPurpose(purpose: ModelPurpose): ModelId {
  return process.env.AGENTMESH_MODEL_PROFILE === "azure"
    ? AZURE_MODEL_BY_PURPOSE[purpose]
    : DEFAULT_GEMINI_MODEL;
}

export function modelForWorkerTier(tier: Tier): ModelId {
  return modelForPurpose(`worker_${tier}`);
}
