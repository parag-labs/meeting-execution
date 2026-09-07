import { describe, expect, it } from "vitest";
import { run } from "../orchestrator";
import { MockExtractor, ScriptedExtractor } from "../llm";
import { shipApiMeeting, REF_DATE } from "../examples";

const extractor = new MockExtractor();
const base = { extractor, clock: () => 0, refDate: REF_DATE };

describe("orchestrator", () => {
  it("extracts decisions and tasks and pauses for approval by default", async () => {
    const result = await run(shipApiMeeting, { ...base, approve: () => false });
    expect(result.status).toBe("awaiting_approval");
    expect(result.executed).toBe(0);
    expect(result.pending.length).toBeGreaterThan(0);
    const decisions = result.events.filter((e) => e.event.type === "DecisionDetected");
    expect(decisions.length).toBeGreaterThan(0);
  });

  it("executes external actions once approved", async () => {
    const result = await run(shipApiMeeting, { ...base, approve: () => true });
    expect(result.status).toBe("completed");
    expect(result.executed).toBeGreaterThan(0);
    const completed = result.events.filter((e) => e.event.type === "ActionCompleted");
    expect(completed.length).toBe(result.executed);
  });

  it("streams the transcript before extracting", async () => {
    const result = await run(shipApiMeeting, { ...base, approve: () => false });
    const types = result.events.map((e) => e.event.type);
    expect(types[0]).toBe("RunStarted");
    expect(types.filter((t) => t === "TranscriptReceived").length).toBe(shipApiMeeting.transcript.length);
    const firstExtract = types.indexOf("IntentExtracted");
    const lastTranscript = types.lastIndexOf("TranscriptReceived");
    expect(lastTranscript).toBeLessThan(firstExtract);
  });

  it("emits a contiguous, ordered event log ending in RunCompleted", async () => {
    const result = await run(shipApiMeeting, { ...base, approve: () => true });
    result.events.forEach((e, i) => expect(e.seq).toBe(i));
    expect(result.events.at(-1)?.event.type).toBe("RunCompleted");
  });

  it("fails safely when the extractor returns invalid output", async () => {
    const bad = new ScriptedExtractor({ decisions: [], tasks: [{ title: "", action: "github_issue" }] } as never);
    const result = await run(shipApiMeeting, { ...base, extractor: bad });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("invalid");
  });

  it("respects the max-actions limit", async () => {
    const result = await run(shipApiMeeting, { ...base, approve: () => true, limits: { maxActions: 1 } });
    const tasks = result.events.filter((e) => e.event.type === "TaskDetected");
    expect(tasks.length).toBe(1);
  });
});
