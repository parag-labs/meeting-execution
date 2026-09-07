# Contributing

Thanks for taking a look. This is a personal portfolio project, but it follows the workflow
I'd use on a team.

## Setup

```bash
pnpm install
pnpm dev
```

Requirements: Node 20+ and pnpm 9+. No API keys and no database needed — the default
extractor is a deterministic mock and the integration providers are mocks.

## Before you push

CI runs exactly these; all must be green:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Ground rules

- **The engine stays framework-free.** Nothing in `src/engine/` may import from `src/app` or
  `src/lib`. The dependency arrow points app → engine only.
- **Keep the core rule intact.** The extractor proposes; deterministic code validates and
  executes. Every action goes through the policy gate — external actions require approval,
  destructive actions are denied.
- **Validate every boundary.** The extractor's output is parsed with Zod before the decision
  engine touches it.
- **Determinism.** Use the injected clock, id counter, and reference date — no `Math.random()`
  or bare `Date.now()`/`new Date()` in engine logic a test can't control. The mock extractor
  must stay pure.
- **Never fabricate eval numbers.** The README table is produced by `pnpm eval`. If behavior
  changes, re-run it and paste the real output.
- **Types over comments.** Prefer making an invalid state unrepresentable (branded ids,
  discriminated unions, the `ActionKind` union) to documenting that it shouldn't happen.

## Commit style

Small, focused commits with imperative subjects. One concern per commit.
