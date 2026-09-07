import { describe, expect, it } from "vitest";
import { defaultProviders } from "../providers";

describe("integration providers", () => {
  const providers = defaultProviders();

  it("registers a provider for each action kind", () => {
    expect(providers.kinds().sort()).toEqual(["calendar_event", "github_issue", "linear_task", "slack_notify"]);
  });

  it("produces a deterministic reference for the same input", async () => {
    const gh = providers.get("github_issue")!;
    const a = await gh.execute({ title: "Ship API", owner: "Engineering" });
    const b = await gh.execute({ title: "Ship API", owner: "Engineering" });
    expect(a).toEqual(b);
    expect(a.provider).toBe("GitHub");
    expect(a.ref).toMatch(/^#\d+$/);
  });

  it("carries the deadline into the calendar provider detail", async () => {
    const cal = providers.get("calendar_event")!;
    const r = await cal.execute({ title: "Review", owner: "Design", deadline: "2026-09-07" });
    expect(r.detail).toContain("2026-09-07");
  });
});
