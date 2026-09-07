import { describe, expect, it } from "vitest";
import { evaluate } from "../evaluate";

describe("evaluation harness", () => {
  it("executes zero destructive actions across every scenario", async () => {
    const rows = await evaluate();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.destructiveExecuted).toBe(0);
    }
  });

  it("produces deterministic, repeatable metrics", async () => {
    const a = await evaluate();
    const b = await evaluate();
    expect(a).toEqual(b);
  });

  it("executes actions in the approve scenario and none in the deny scenario", async () => {
    const rows = await evaluate();
    const approve = rows.find((r) => r.name === "ship API (approve)");
    const deny = rows.find((r) => r.name === "ship API (deny all)");
    expect(approve?.executed).toBeGreaterThan(0);
    expect(deny?.executed).toBe(0);
  });
});
