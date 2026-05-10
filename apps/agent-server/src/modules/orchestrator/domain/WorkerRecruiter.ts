import type { IAgentRegistry } from "../ports/outbound/IAgentRegistry";
import type { SubtaskNode, WorkerCandidate } from "./types";

export class WorkerRecruiter {
  constructor(
    private readonly registry: IAgentRegistry,
    private readonly minReputation: number,
  ) {}

  async recruit(subtask: SubtaskNode): Promise<WorkerCandidate> {
    const candidates = await this.registry.getAgentsByCapability(
      subtask.capabilityMask,
      this.minReputation,
    );
    const eligible = candidates
      .filter((candidate) => candidate.reputationScore >= this.minReputation)
      .filter(
        (candidate) =>
          subtask.capabilityMask === 0n ||
          (candidate.capabilityMask & subtask.capabilityMask) === subtask.capabilityMask,
      )
      .sort(compareCandidates);

    if (!eligible[0]) {
      throw new Error(
        `No worker candidates available for subtask ${subtask.id} with capabilities ${subtask.requiredCapabilities.join(",")}`,
      );
    }

    return eligible[0];
  }
}

function compareCandidates(left: WorkerCandidate, right: WorkerCandidate): number {
  if (right.reputationScore !== left.reputationScore) {
    return right.reputationScore - left.reputationScore;
  }

  if (left.pricePerTaskLamports < right.pricePerTaskLamports) {
    return -1;
  }
  if (left.pricePerTaskLamports > right.pricePerTaskLamports) {
    return 1;
  }

  return left.agentPda.localeCompare(right.agentPda);
}
