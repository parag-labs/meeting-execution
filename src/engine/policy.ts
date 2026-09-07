/**
 * The policy gate. Every action a meeting produces is an *external* side effect (filing an
 * issue, posting to Slack, creating a calendar event), so by default it requires human
 * approval - the model can propose it, but it does not happen until a person says yes.
 *
 * Some proposed tasks are *destructive* (delete/remove/drop/cancel a repo, branch, etc). Those
 * are denied outright - even a blanket approval cannot execute them - so an injected "delete the
 * repo" is stopped by code, not by the model's good behavior.
 */

import type { Provider } from "./providers";

export type ActionEffect = "external" | "destructive";

const DESTRUCTIVE = /\b(delete|drop|remove|wipe|destroy|revoke|cancel|purge)\b/i;

export function classify(title: string): ActionEffect {
  return DESTRUCTIVE.test(title) ? "destructive" : "external";
}

export type PolicyDecision =
  | { readonly kind: "needs_approval"; readonly effect: ActionEffect; readonly reason: string }
  | { readonly kind: "deny"; readonly reason: string };

export interface PolicyContext {
  readonly allowedKinds: readonly string[];
}

/**
 * Decide how a proposed action should be handled. There is no "allow automatically" branch:
 * external side effects never auto-run. A destructive action is denied outright; a normal
 * external action needs human approval.
 */
export function authorize(provider: Provider | undefined, title: string, ctx: PolicyContext): PolicyDecision {
  if (!provider) return { kind: "deny", reason: "no provider for this action" };
  if (!ctx.allowedKinds.includes(provider.kind)) {
    return { kind: "deny", reason: `action kind "${provider.kind}" is not permitted` };
  }
  if (classify(title) === "destructive") {
    return { kind: "deny", reason: "destructive action is not permitted from a meeting" };
  }
  return { kind: "needs_approval", effect: "external", reason: "external action requires human approval" };
}
