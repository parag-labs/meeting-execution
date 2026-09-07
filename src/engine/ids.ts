/**
 * Branded id types so a decision id can never be used where a task or action id is expected,
 * even though all are strings at runtime. Ids come from a deterministic counter for
 * reproducible runs.
 */

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type RunId = Brand<string, "RunId">;
export type DecisionId = Brand<string, "DecisionId">;
export type TaskId = Brand<string, "TaskId">;
export type ActionId = Brand<string, "ActionId">;

export const RunId = (s: string): RunId => s as RunId;
export const DecisionId = (s: string): DecisionId => s as DecisionId;
export const TaskId = (s: string): TaskId => s as TaskId;
export const ActionId = (s: string): ActionId => s as ActionId;

export function makeCounter(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}_${++n}`;
}
