/**
 * The typed event model. A meeting run is fully described by the ordered events it emits,
 * which powers the live transcript/decision stream in the UI and after-the-fact replay. Every
 * event is a plain, serializable record - safe to persist and to send over SSE.
 */

import type { ActionId, DecisionId, RunId, TaskId } from "./ids";
import type { ActionKind } from "./llm";
import type { ActionEffect } from "./policy";

export type RunStatus = "completed" | "awaiting_approval" | "failed";

export type AgentEvent =
  | { readonly type: "RunStarted"; readonly title: string }
  | { readonly type: "TranscriptReceived"; readonly index: number; readonly line: string }
  | { readonly type: "IntentExtracted"; readonly decisions: number; readonly tasks: number; readonly tokens: number }
  | { readonly type: "DecisionDetected"; readonly id: DecisionId; readonly statement: string; readonly owner: string; readonly deadline: string | undefined }
  | { readonly type: "TaskDetected"; readonly id: TaskId; readonly title: string; readonly kind: ActionKind; readonly owner: string; readonly deadline: string | undefined }
  | { readonly type: "ApprovalRequested"; readonly action: ActionId; readonly kind: ActionKind; readonly effect: ActionEffect }
  | { readonly type: "ApprovalDecided"; readonly action: ActionId; readonly approved: boolean }
  | { readonly type: "ActionRequested"; readonly action: ActionId; readonly provider: string }
  | { readonly type: "ActionCompleted"; readonly action: ActionId; readonly provider: string; readonly ref: string; readonly detail: string }
  | { readonly type: "ActionRejected"; readonly action: ActionId; readonly reason: string }
  | { readonly type: "RunPaused"; readonly reason: string }
  | { readonly type: "RunCompleted"; readonly status: RunStatus }
  | { readonly type: "RunFailed"; readonly error: string };

export type AgentEventType = AgentEvent["type"];

export interface LoggedEvent {
  readonly seq: number;
  readonly at: number;
  readonly runId: RunId;
  readonly event: AgentEvent;
}

/** An append-only log with an optional listener that fires as each event is appended (for SSE). */
export class EventLog {
  private readonly events: LoggedEvent[] = [];
  private seq = 0;

  constructor(
    private readonly runId: RunId,
    private readonly clock: () => number = () => Date.now(),
    private readonly onAppend?: (e: LoggedEvent) => void,
  ) {}

  append(event: AgentEvent): LoggedEvent {
    const logged: LoggedEvent = { seq: this.seq++, at: this.clock(), runId: this.runId, event };
    this.events.push(logged);
    this.onAppend?.(logged);
    return logged;
  }

  all(): readonly LoggedEvent[] {
    return this.events;
  }
}
