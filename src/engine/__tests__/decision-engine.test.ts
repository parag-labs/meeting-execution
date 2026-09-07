import { describe, expect, it } from "vitest";
import { buildPlan, resolveDeadline, resolveOwner } from "../decision-engine";
import { REF_DATE } from "../examples";

describe("decision engine", () => {
  it("maps owner hints to canonical teams and defaults to Engineering", () => {
    expect(resolveOwner("engineering")).toBe("Engineering");
    expect(resolveOwner("Design")).toBe("Design");
    expect(resolveOwner(undefined)).toBe("Engineering");
    expect(resolveOwner("legal")).toBe("Legal");
  });

  it("resolves a weekday hint to the next matching date deterministically", () => {
    // REF_DATE is Tuesday 2026-09-01; the next Friday is 2026-09-04.
    expect(resolveDeadline("friday", REF_DATE)).toBe("2026-09-04");
    // The next Monday is 2026-09-07.
    expect(resolveDeadline("monday", REF_DATE)).toBe("2026-09-07");
    // Same weekday means next week, not today.
    expect(resolveDeadline("tuesday", REF_DATE)).toBe("2026-09-08");
  });

  it("returns no deadline when there is no weekday hint", () => {
    expect(resolveDeadline(undefined, REF_DATE)).toBeUndefined();
    expect(resolveDeadline("someday", REF_DATE)).toBeUndefined();
  });

  it("builds a plan of decisions and actions with resolved owners/deadlines", () => {
    const plan = buildPlan(
      {
        decisions: [{ statement: "Ship API", ownerHint: "engineering", deadlineHint: "friday" }],
        tasks: [{ title: "Create issue: Ship API", action: "github_issue", ownerHint: "engineering", deadlineHint: "friday" }],
      },
      REF_DATE,
    );
    expect(plan.decisions[0]).toMatchObject({ owner: "Engineering", deadline: "2026-09-04" });
    expect(plan.actions[0]).toMatchObject({ kind: "github_issue", owner: "Engineering", deadline: "2026-09-04" });
  });
});
