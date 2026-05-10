import type { DeclareTierInput, ITaskEscrow } from "../../../ports/outbound/ITaskEscrow";

export class MockTaskEscrow implements ITaskEscrow {
  readonly declarations: DeclareTierInput[] = [];

  async declareTier(input: DeclareTierInput): Promise<string> {
    this.declarations.push(input);
    return `mockDeclareTier_${input.subtaskPda}_${input.tier}`;
  }
}
