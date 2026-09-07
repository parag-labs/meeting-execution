import { describe, expect, it } from "vitest";
import { authorize, classify } from "../policy";
import { defaultProviders } from "../providers";

const providers = defaultProviders();
const ctx = { allowedKinds: providers.kinds() };

describe("policy gate", () => {
  it("classifies destructive vs external titles", () => {
    expect(classify("Create issue: ship the API")).toBe("external");
    expect(classify("delete the repo")).toBe("destructive");
    expect(classify("cancel the release")).toBe("destructive");
  });

  it("requires approval for a normal external action", () => {
    const decision = authorize(providers.get("github_issue"), "Create issue: ship API", ctx);
    expect(decision.kind).toBe("needs_approval");
  });

  it("denies a destructive action outright", () => {
    const decision = authorize(providers.get("github_issue"), "delete the repo", ctx);
    expect(decision.kind).toBe("deny");
  });

  it("denies an action with no provider", () => {
    expect(authorize(undefined, "anything", ctx).kind).toBe("deny");
  });

  it("denies an action kind that is not permitted", () => {
    const decision = authorize(providers.get("slack_notify"), "ping the team", { allowedKinds: ["github_issue"] });
    expect(decision.kind).toBe("deny");
  });
});
