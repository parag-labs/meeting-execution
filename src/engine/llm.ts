/**
 * The extraction step - the only place a model runs. An extractor reads transcript lines and
 * *proposes* a structured set of decisions and tasks. It never executes anything; the decision
 * engine and orchestrator validate the proposal and decide what actually happens. Swapping in
 * a real model means implementing this one interface.
 */

import { z } from "zod";

/** The kind of external action a task maps to. Drives which provider (and permission) applies. */
export const actionKind = z.enum(["github_issue", "linear_task", "calendar_event", "slack_notify"]);
export type ActionKind = z.infer<typeof actionKind>;

/** The structured proposal an extractor returns. Validated with Zod before the engine trusts it. */
export const extractionSchema = z.object({
  decisions: z
    .array(
      z.object({
        statement: z.string().min(1),
        ownerHint: z.string().optional(),
        deadlineHint: z.string().optional(),
      }),
    )
    .default([]),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        ownerHint: z.string().optional(),
        deadlineHint: z.string().optional(),
        action: actionKind.optional(),
      }),
    )
    .default([]),
});
export type Extraction = z.infer<typeof extractionSchema>;

export interface ExtractRequest {
  readonly transcript: readonly string[];
}

export interface ExtractResponse {
  readonly extraction: Extraction;
  readonly tokens: number;
}

export interface Extractor {
  extract(req: ExtractRequest): Promise<ExtractResponse>;
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const OWNERS = ["engineering", "design", "product", "marketing", "sales"];

/**
 * A deterministic mock extractor. It turns commitment-shaped sentences ("let's ship X by
 * Friday", "we should create ...") into decisions and tasks, guessing owner and deadline from
 * simple cues. It is deliberately literal: if a line asks to "delete the repo" it will faithfully
 * propose that task - which is exactly what lets the security test prove the policy gate, not the
 * extractor, is what refuses to run destructive actions.
 */
export class MockExtractor implements Extractor {
  async extract(req: ExtractRequest): Promise<ExtractResponse> {
    const decisions: Extraction["decisions"] = [];
    const tasks: Extraction["tasks"] = [];

    for (const raw of req.transcript) {
      const line = raw.trim();
      const lower = line.toLowerCase();
      const deadlineHint = WEEKDAYS.find((d) => lower.includes(d));
      const ownerHint = OWNERS.find((o) => lower.includes(o));

      const isDecision = /\b(let's|lets|we will|we'll|we should|decision|ship|approve|go with)\b/.test(lower);
      const isTask = /\b(create|file|open|send|schedule|notify|assign|delete|remove|cancel)\b/.test(lower);

      if (isDecision) {
        decisions.push({ statement: cleanStatement(line), ...(ownerHint ? { ownerHint } : {}), ...(deadlineHint ? { deadlineHint } : {}) });
        tasks.push({ title: `Create issue: ${cleanStatement(line)}`, action: "github_issue", ...(ownerHint ? { ownerHint } : {}), ...(deadlineHint ? { deadlineHint } : {}) });
      } else if (isTask) {
        tasks.push({ title: cleanStatement(line), action: actionFor(lower), ...(ownerHint ? { ownerHint } : {}), ...(deadlineHint ? { deadlineHint } : {}) });
      }
    }

    const tokens = 12 + req.transcript.join(" ").split(/\s+/).length;
    return { extraction: { decisions, tasks }, tokens };
  }
}

/** An extractor that returns a fixed, caller-supplied extraction. Useful for targeted tests. */
export class ScriptedExtractor implements Extractor {
  constructor(private readonly extraction: Extraction, private readonly tokens = 20) {}
  async extract(): Promise<ExtractResponse> {
    return { extraction: this.extraction, tokens: this.tokens };
  }
}

function cleanStatement(line: string): string {
  return line.replace(/^[-*\d.\s]+/, "").replace(/^(so|ok|okay|alright|and)\s+/i, "").trim();
}

function actionFor(lower: string): ActionKind {
  if (lower.includes("notify") || lower.includes("slack") || lower.includes("message")) return "slack_notify";
  if (lower.includes("schedule") || lower.includes("calendar") || lower.includes("meeting")) return "calendar_event";
  if (lower.includes("linear") || lower.includes("jira")) return "linear_task";
  return "github_issue";
}
