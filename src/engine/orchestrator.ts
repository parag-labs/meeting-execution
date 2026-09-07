/**
 * The orchestrator: the deterministic core that turns a meeting transcript into executed
 * actions. It streams the transcript, asks the extractor to *propose* decisions and tasks,
 * validates that proposal with Zod, resolves owners and deadlines, then runs every action
 * through the policy gate. External actions wait for approval; destructive ones are denied by
 * default. Every step is an event, so the run streams live and replays exactly.
 *
 * The rule the whole design enforces: the LLM extracts and proposes; this code validates and
 * executes.
 */

import { buildPlan, type PlannedAction } from "./decision-engine";
import { EventLog, type LoggedEvent, type RunStatus } from "./events";
import { makeCounter, RunId } from "./ids";
import { extractionSchema, type Extractor } from "./llm";
import { authorize, type ActionEffect } from "./policy";
import { defaultProviders, ProviderRegistry } from "./providers";

export interface AgentLimits {
  readonly maxActions: number;
  readonly tokenBudget: number;
}

export const DEFAULT_LIMITS: AgentLimits = { maxActions: 20, tokenBudget: 4000 };

export interface RunRequest {
  readonly title: string;
  readonly transcript: readonly string[];
}

export interface ApprovalContext {
  readonly action: PlannedAction;
  readonly effect: ActionEffect;
}

export interface RunOptions {
  readonly extractor: Extractor;
  readonly providers?: ProviderRegistry;
  /** Approve an action. Default: deny everything (nothing external auto-runs). */
  readonly approve?: (ctx: ApprovalContext) => boolean;
  readonly clock?: () => number;
  readonly refDate?: Date;
  readonly runId?: RunId;
  readonly limits?: Partial<AgentLimits>;
  readonly onEvent?: (e: LoggedEvent) => void;
}

export interface RunResult {
  readonly runId: RunId;
  readonly status: RunStatus;
  readonly events: readonly LoggedEvent[];
  readonly executed: number;
  readonly pending: readonly PlannedAction[];
  readonly tokens: number;
  readonly error?: string;
}

/** Execute a meeting run to completion or to a pause for approval. */
export async function run(request: RunRequest, opts: RunOptions): Promise<RunResult> {
  const clock = opts.clock ?? (() => Date.now());
  const runId = opts.runId ?? RunId(makeCounter("run")());
  const providers = opts.providers ?? defaultProviders();
  const approve = opts.approve ?? (() => false);
  const refDate = opts.refDate ?? new Date();
  const limits: AgentLimits = { ...DEFAULT_LIMITS, ...opts.limits };
  const log = new EventLog(runId, clock, opts.onEvent);

  log.append({ type: "RunStarted", title: request.title });

  try {
    request.transcript.forEach((line, index) => log.append({ type: "TranscriptReceived", index, line }));

    const { extraction, tokens } = await opts.extractor.extract({ transcript: request.transcript });
    if (tokens > limits.tokenBudget) throw new Error(`token budget exceeded: ${tokens} > ${limits.tokenBudget}`);

    // Zod at the trust boundary: the model's output is validated before the engine acts on it.
    const parsed = extractionSchema.safeParse(extraction);
    if (!parsed.success) throw new Error(`extractor returned invalid output: ${parsed.error.issues.map((i) => i.message).join("; ")}`);

    log.append({ type: "IntentExtracted", decisions: parsed.data.decisions.length, tasks: parsed.data.tasks.length, tokens });

    const plan = buildPlan(parsed.data, refDate);
    for (const d of plan.decisions) {
      log.append({ type: "DecisionDetected", id: d.id, statement: d.statement, owner: d.owner, deadline: d.deadline });
    }

    const actions = plan.actions.slice(0, limits.maxActions);
    for (const a of actions) {
      log.append({ type: "TaskDetected", id: a.taskId, title: a.title, kind: a.kind, owner: a.owner, deadline: a.deadline });
    }

    let executed = 0;
    const pending: PlannedAction[] = [];

    for (const action of actions) {
      const provider = providers.get(action.kind);
      const decision = authorize(provider, action.title, { allowedKinds: providers.kinds() });

      if (decision.kind === "deny") {
        log.append({ type: "ActionRejected", action: action.id, reason: decision.reason });
        continue;
      }

      log.append({ type: "ApprovalRequested", action: action.id, kind: action.kind, effect: decision.effect });
      const approved = approve({ action, effect: decision.effect });
      log.append({ type: "ApprovalDecided", action: action.id, approved });

      if (!approved) {
        pending.push(action);
        continue;
      }

      log.append({ type: "ActionRequested", action: action.id, provider: provider!.name });
      try {
        const result = await provider!.execute({ title: action.title, owner: action.owner, deadline: action.deadline });
        log.append({ type: "ActionCompleted", action: action.id, provider: result.provider, ref: result.ref, detail: result.detail });
        executed++;
      } catch (err) {
        log.append({ type: "ActionRejected", action: action.id, reason: err instanceof Error ? err.message : String(err) });
      }
    }

    if (pending.length > 0) {
      log.append({ type: "RunPaused", reason: `${pending.length} action(s) awaiting approval` });
      log.append({ type: "RunCompleted", status: "awaiting_approval" });
      return { runId, status: "awaiting_approval", events: log.all(), executed, pending, tokens };
    }

    log.append({ type: "RunCompleted", status: "completed" });
    return { runId, status: "completed", events: log.all(), executed, pending: [], tokens };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.append({ type: "RunFailed", error });
    return { runId, status: "failed", events: log.all(), executed: 0, pending: [], tokens: 0, error };
  }
}
