/**
 * Replay: reconstruct a run's state by folding its event log forward. Because a run is fully
 * described by its events, replay is exact and backs the UI timeline and debugging.
 */

import type { AgentEvent, LoggedEvent, RunStatus } from "./events";

export interface RunView {
  readonly title: string;
  readonly transcriptLines: number;
  readonly decisions: number;
  readonly tasks: number;
  readonly executed: number;
  readonly rejected: number;
  readonly approvalsRequested: number;
  readonly status: RunStatus | "running";
}

const EMPTY: RunView = {
  title: "",
  transcriptLines: 0,
  decisions: 0,
  tasks: 0,
  executed: 0,
  rejected: 0,
  approvalsRequested: 0,
  status: "running",
};

function apply(view: RunView, event: AgentEvent): RunView {
  switch (event.type) {
    case "RunStarted":
      return { ...view, title: event.title };
    case "TranscriptReceived":
      return { ...view, transcriptLines: view.transcriptLines + 1 };
    case "DecisionDetected":
      return { ...view, decisions: view.decisions + 1 };
    case "TaskDetected":
      return { ...view, tasks: view.tasks + 1 };
    case "ActionCompleted":
      return { ...view, executed: view.executed + 1 };
    case "ActionRejected":
      return { ...view, rejected: view.rejected + 1 };
    case "ApprovalRequested":
      return { ...view, approvalsRequested: view.approvalsRequested + 1 };
    case "RunCompleted":
      return { ...view, status: event.status };
    case "RunFailed":
      return { ...view, status: "failed" };
    default:
      return view;
  }
}

/** Fold events up to and including `untilSeq` (default: all) into a run view. */
export function replay(events: readonly LoggedEvent[], untilSeq = Infinity): RunView {
  return events.filter((e) => e.seq <= untilSeq).reduce((view, e) => apply(view, e.event), EMPTY);
}
