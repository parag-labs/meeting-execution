/**
 * The public surface for the meeting-execution engine: ids, typed events, the extractor
 * abstraction, the deterministic decision engine, the integration providers, the policy gate,
 * the orchestrator, replay, evaluation, and shared examples. The UI and API depend only on
 * this barrel.
 */

export * from "./ids";
export * from "./events";
export * from "./llm";
export * from "./providers";
export * from "./policy";
export * from "./decision-engine";
export * from "./orchestrator";
export * from "./replay";
export * from "./evaluate";
export * from "./examples";
