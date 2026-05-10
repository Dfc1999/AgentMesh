import type { SubtaskExecutionRecord, TimeoutPolicy } from "./types";

export class TimeoutManager {
  constructor(private readonly policy: TimeoutPolicy) {}

  findTimedOut(records: SubtaskExecutionRecord[], now = Date.now()): SubtaskExecutionRecord[] {
    return records.filter((record) => {
      if (record.status !== "running" || !record.startedAt) {
        return false;
      }

      const startedAt = new Date(record.startedAt).getTime();
      return now - startedAt > this.policy.subtaskTimeoutMs;
    });
  }

  nextHeartbeatDeadline(startedAt: string): string {
    return new Date(new Date(startedAt).getTime() + this.policy.heartbeatMs).toISOString();
  }
}
