/**
 * The decision engine: deterministic resolution of the fuzzy hints an extractor produces into
 * concrete owners and deadlines, and the assembly of executable actions. This is where "by
 * Friday" becomes a real date and "engineering" becomes a team - reproducibly, so the same
 * transcript always yields the same plan.
 */

import { ActionId, DecisionId, makeCounter, TaskId } from "./ids";
import type { ActionKind, Extraction } from "./llm";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const OWNER_MAP: Record<string, string> = {
  engineering: "Engineering",
  design: "Design",
  product: "Product",
  marketing: "Marketing",
  sales: "Sales",
};

export interface ResolvedDecision {
  readonly id: DecisionId;
  readonly statement: string;
  readonly owner: string;
  readonly deadline: string | undefined;
}

export interface PlannedAction {
  readonly id: ActionId;
  readonly taskId: TaskId;
  readonly title: string;
  readonly kind: ActionKind;
  readonly owner: string;
  readonly deadline: string | undefined;
}

export interface Plan {
  readonly decisions: readonly ResolvedDecision[];
  readonly actions: readonly PlannedAction[];
}

/** Map an owner hint to a canonical team name, defaulting to Engineering. */
export function resolveOwner(hint?: string): string {
  if (!hint) return "Engineering";
  return OWNER_MAP[hint.toLowerCase()] ?? capitalize(hint);
}

/**
 * Resolve a deadline hint ("friday") to an ISO date string, relative to a reference date. The
 * reference is injectable so the resolution is deterministic in tests. Returns undefined when
 * there is no recognizable weekday hint.
 */
export function resolveDeadline(hint: string | undefined, from: Date): string | undefined {
  if (!hint) return undefined;
  const target = WEEKDAYS.indexOf(hint.toLowerCase());
  if (target < 0) return undefined;
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let delta = (target - start.getUTCDay() + 7) % 7;
  if (delta === 0) delta = 7; // "Friday" means the next Friday, not today
  start.setUTCDate(start.getUTCDate() + delta);
  return start.toISOString().slice(0, 10);
}

/** Turn a validated extraction into a concrete plan of decisions and executable actions. */
export function buildPlan(extraction: Extraction, refDate: Date): Plan {
  const decisionId = makeCounter("dec");
  const taskId = makeCounter("task");
  const actionId = makeCounter("act");

  const decisions: ResolvedDecision[] = extraction.decisions.map((d) => ({
    id: DecisionId(decisionId()),
    statement: d.statement,
    owner: resolveOwner(d.ownerHint),
    deadline: resolveDeadline(d.deadlineHint, refDate),
  }));

  const actions: PlannedAction[] = extraction.tasks.map((t) => ({
    id: ActionId(actionId()),
    taskId: TaskId(taskId()),
    title: t.title,
    kind: t.action ?? "github_issue",
    owner: resolveOwner(t.ownerHint),
    deadline: resolveDeadline(t.deadlineHint, refDate),
  }));

  return { decisions, actions };
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}
