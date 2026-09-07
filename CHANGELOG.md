# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-07

First public release.

### Added
- Deterministic orchestrator (`orchestrator.ts`) that turns a meeting transcript into
  decisions and executed actions: stream transcript → extract → validate → resolve →
  authorize → execute, all event-sourced.
- Extractor abstraction (`llm.ts`) with a deterministic `MockExtractor` and
  `ScriptedExtractor`; the extraction is validated with Zod before the engine trusts it.
- Deterministic decision engine (`decision-engine.ts`): owner resolution and weekday →
  date deadline resolution relative to an injectable reference date, plus plan assembly.
- Integration provider abstraction (`providers.ts`) with mock GitHub, Slack, Calendar and
  Linear providers behind a `Provider` interface and a registry keyed by action kind.
- Policy gate (`policy.ts`): external actions require human approval; destructive actions
  are denied outright.
- Typed `AgentEvent` union and append-only `EventLog` with a live-streaming hook; an SSE
  endpoint streams runs to the dashboard as they happen.
- Replay that folds an event log into a run view.
- Evaluation harness and `pnpm eval` CLI producing real, reproducible metrics (0 destructive
  actions executed across all scenarios).
- Test suite: unit (decision engine, providers, policy), failure-path, security
  (prompt-injection), and evaluation.
- Next.js dashboard (decisions, actions, live event stream), Docker + docker-compose, GitHub
  Actions CI (lint / typecheck / test / build / eval + dependency audit), and full docs.

[0.1.0]: https://github.com/parag-labs/meeting-execution/releases/tag/v0.1.0
