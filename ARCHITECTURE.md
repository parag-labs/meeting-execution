# Architecture

Meeting → Execution has two halves separated by a hard boundary:

1. **A deterministic engine** (`src/engine/`) with no framework dependencies — the extractor
   abstraction, decision engine, provider registry, policy gate, orchestrator, event log,
   replay, and evaluation. This is the tested core.
2. **A thin Next.js shell** (`src/app`, `src/lib`) that streams runs over SSE and keeps a
   small in-memory history.

## The core rule

> The LLM extracts and proposes. Deterministic application code validates and executes.

Only the extractor (`llm.ts`) runs a model, and all it produces is a *proposal* — structured
decisions and tasks. It cannot execute anything. The decision engine resolves the proposal
into a concrete plan, and the orchestrator authorizes and runs each action; external actions
wait for a human, destructive ones are refused.

## Request lifecycle

```
transcript lines
    ↓
Extractor.extract()             # LLM (or MockExtractor) — proposes decisions + tasks
    ↓
extractionSchema.parse()        # Zod — validate untrusted model output
    ↓
buildPlan()                     # deterministic — resolve owner + deadline, assemble actions
    ↓
for each action:
    authorize(title, kind)      # policy gate — deny (destructive) or needs_approval (external)
        needs_approval → ask human; execute via provider if approved, else hold pending
        deny           → reject, record, continue
    ↓
emit RunCompleted / awaiting_approval / failed
```

Every arrow emits a typed event onto an append-only log.

## Modules

| Module | Responsibility |
|--------|----------------|
| `ids.ts` | Branded id types + a deterministic monotonic counter. |
| `events.ts` | The `AgentEvent` discriminated union and the append-only `EventLog` (with an `onAppend` hook for live streaming). |
| `llm.ts` | The `Extractor` interface, the deterministic `MockExtractor`, `ScriptedExtractor`, and the extraction Zod schema. |
| `decision-engine.ts` | Deterministic `resolveOwner`, `resolveDeadline` (weekday → date relative to an injectable reference), and `buildPlan`. |
| `providers.ts` | The `Provider` interface and mock GitHub/Slack/Calendar/Linear, plus a registry keyed by action kind. |
| `policy.ts` | `authorize()` — external actions need approval, destructive actions are denied. |
| `orchestrator.ts` | `run()` — bounded, event-sourced transcript → execution. |
| `replay.ts` | Fold an event log into a `RunView` at any point. |
| `evaluate.ts` | Repeatable scored scenarios; metrics derived purely from event logs. |

## Why deterministic resolution

The interesting, defensible engineering is turning fuzzy language into commitments *without*
a model: *"Friday"* resolves to the next Friday relative to a reference date (injectable, so
it's testable and reproducible), and *"engineering"* maps to a canonical team. Doing this in
code — not in the prompt — is what makes the output stable and the deadlines correct. The
model is used only for the genuinely linguistic part: spotting which sentences are decisions
or tasks.

## Event sourcing & realtime

`run()` appends immutable events; the `RunResult` and every UI view derive from them. The
`EventLog` takes an `onAppend` callback, which the SSE route uses to push each event —
transcript line, decision, task, approval, executed action — to the browser as it happens.
The same log powers replay and the run history.

## The provider abstraction

`Provider` is the spec's integration interface: a `name`, an `ActionKind`, and an `execute`
method returning a reference. The registry maps each `ActionKind` to a provider. Mocks ship
first (GitHub/Slack/Calendar/Linear); wiring a real integration means implementing `execute`
against a real API *behind the same policy gate* — nothing else changes.

## Bounded execution & determinism

`AgentLimits` caps `maxActions` and `tokenBudget`; the extractor's token estimate is checked
before any action runs. The clock, id counter, and reference date are injectable, and
`MockExtractor` is pure — which is why the eval table is reproducible and safe to commit.
