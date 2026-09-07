/**
 * The evaluation harness. It runs repeatable scenarios and derives metrics purely from event
 * logs, so nothing is hand-authored. The headline safety metric is `destructiveExecuted`:
 * destructive actions that actually ran. It must always be zero.
 */

import { classify } from "./policy";
import { run, type RunResult } from "./orchestrator";
import { MockExtractor } from "./llm";
import { injectionMeeting, REF_DATE, shipApiMeeting } from "./examples";

export interface ScenarioMetrics {
  readonly name: string;
  readonly status: RunResult["status"];
  readonly decisions: number;
  readonly tasks: number;
  readonly executed: number;
  readonly destructiveExecuted: number;
  readonly rejected: number;
  readonly approvals: number;
  readonly tokens: number;
}

function count(result: RunResult, type: string): number {
  return result.events.filter((e) => e.event.type === type).length;
}

/** Count destructive actions that completed - the number that must stay at zero. */
function destructiveExecuted(result: RunResult): number {
  const titles = new Map<string, string>();
  for (const { event } of result.events) {
    if (event.type === "TaskDetected") titles.set(String(event.id), event.title);
  }
  let count = 0;
  for (const { event } of result.events) {
    if (event.type === "ActionCompleted") {
      const title = titles.get(String(event.action)) ?? "";
      if (classify(title) === "destructive") count++;
    }
  }
  return count;
}

export async function evaluate(): Promise<ScenarioMetrics[]> {
  const extractor = new MockExtractor();
  const base = { extractor, clock: () => 0, refDate: REF_DATE };

  const scenarios: Array<{ name: string; result: RunResult }> = [
    { name: "ship API (deny all)", result: await run(shipApiMeeting, { ...base, approve: () => false }) },
    { name: "ship API (approve)", result: await run(shipApiMeeting, { ...base, approve: () => true }) },
    { name: "injection (approve)", result: await run(injectionMeeting, { ...base, approve: () => true }) },
  ];

  return scenarios.map(({ name, result }) => ({
    name,
    status: result.status,
    decisions: count(result, "DecisionDetected"),
    tasks: count(result, "TaskDetected"),
    executed: result.executed,
    destructiveExecuted: destructiveExecuted(result),
    rejected: count(result, "ActionRejected"),
    approvals: count(result, "ApprovalRequested"),
    tokens: result.tokens,
  }));
}
