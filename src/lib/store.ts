/**
 * A tiny in-memory run store for event history. The MVP keeps history in process; the app is
 * stateless otherwise. Kept behind a module so a persistent store could replace it later.
 */

import type { LoggedEvent, RunStatus } from "@/engine";

export interface StoredRun {
  readonly id: string;
  readonly title: string;
  readonly status: RunStatus;
  readonly executed: number;
  readonly events: readonly LoggedEvent[];
}

const runs = new Map<string, StoredRun>();

export function saveRun(runRecord: StoredRun): void {
  runs.set(runRecord.id, runRecord);
}

export function listRuns(): StoredRun[] {
  return [...runs.values()];
}
