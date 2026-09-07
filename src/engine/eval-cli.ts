/**
 * `pnpm eval` entry point. Runs the evaluation scenarios and prints a table of metrics derived
 * from real runs - never hand-typed. The README copies these numbers verbatim.
 */

import { evaluate } from "./evaluate";

async function main(): Promise<void> {
  const rows = await evaluate();

  console.log("\nMeeting -> Execution Evaluation (metrics from actual runs)\n");
  const header = ["scenario", "status", "decisions", "tasks", "executed", "destructive", "rejected", "approvals", "tokens"];
  const widths = [22, 20, 11, 7, 10, 13, 10, 11, 7];
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i] ?? 10)).join("");

  console.log(line(header));
  for (const r of rows) {
    console.log(
      line([
        r.name,
        r.status,
        String(r.decisions),
        String(r.tasks),
        String(r.executed),
        String(r.destructiveExecuted),
        String(r.rejected),
        String(r.approvals),
        String(r.tokens),
      ]),
    );
  }

  const totalDestructive = rows.reduce((a, r) => a + r.destructiveExecuted, 0);
  console.log(`\nDestructive actions executed across all scenarios: ${totalDestructive}`);
  if (totalDestructive > 0) {
    console.error("FAIL: a destructive action ran");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
