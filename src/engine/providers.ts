/**
 * The integration abstraction. The spec asks for a provider interface with mock GitHub, Slack,
 * Calendar and Linear/Jira implementations built first. Every provider performs an *external*
 * side effect, which is why executing one always requires human approval (see policy.ts). The
 * providers here are deterministic mocks so tests and CI need no real integrations or tokens.
 */

import type { ActionKind } from "./llm";

export interface ActionInput {
  readonly title: string;
  readonly owner: string;
  readonly deadline?: string;
}

export interface ExecutedAction {
  readonly provider: string;
  readonly kind: ActionKind;
  readonly ref: string;
  readonly detail: string;
}

export interface Provider {
  readonly name: string;
  readonly kind: ActionKind;
  execute(input: ActionInput): Promise<ExecutedAction> | ExecutedAction;
}

/** Mock GitHub: "creates" an issue and returns a deterministic reference. */
const github: Provider = {
  name: "GitHub",
  kind: "github_issue",
  execute: (i) => ({ provider: "GitHub", kind: "github_issue", ref: `#${refNumber(i.title)}`, detail: `issue "${i.title}" for ${i.owner}` }),
};

const linear: Provider = {
  name: "Linear",
  kind: "linear_task",
  execute: (i) => ({ provider: "Linear", kind: "linear_task", ref: `ENG-${refNumber(i.title)}`, detail: `task "${i.title}" for ${i.owner}` }),
};

const calendar: Provider = {
  name: "Calendar",
  kind: "calendar_event",
  execute: (i) => ({ provider: "Calendar", kind: "calendar_event", ref: `evt-${refNumber(i.title)}`, detail: `deadline ${i.deadline ?? "unscheduled"} for "${i.title}"` }),
};

const slack: Provider = {
  name: "Slack",
  kind: "slack_notify",
  execute: (i) => ({ provider: "Slack", kind: "slack_notify", ref: `msg-${refNumber(i.title)}`, detail: `notified ${i.owner} about "${i.title}"` }),
};

/** A registry keyed by action kind. */
export class ProviderRegistry {
  private readonly byKind = new Map<ActionKind, Provider>();

  register(provider: Provider): this {
    this.byKind.set(provider.kind, provider);
    return this;
  }

  get(kind: ActionKind): Provider | undefined {
    return this.byKind.get(kind);
  }

  kinds(): ActionKind[] {
    return [...this.byKind.keys()];
  }
}

export function defaultProviders(): ProviderRegistry {
  return new ProviderRegistry().register(github).register(linear).register(calendar).register(slack);
}

/** A stable pseudo-reference derived from the title, so runs are reproducible. */
function refNumber(title: string): number {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) % 9000;
  return 1000 + h;
}
