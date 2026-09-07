import { describe, expect, it } from "vitest";
import { run } from "../orchestrator";
import { replay } from "../replay";
import { MockExtractor } from "../llm";
import { shipApiMeeting, REF_DATE } from "../examples";

describe("replay", () => {
  it("reconstructs the final run view from the event log", async () => {
    const result = await run(shipApiMeeting, { extractor: new MockExtractor(), clock: () => 0, refDate: REF_DATE, approve: () => true });
    const view = replay(result.events);
    expect(view.title).toBe("API planning");
    expect(view.transcriptLines).toBe(shipApiMeeting.transcript.length);
    expect(view.status).toBe("completed");
    expect(view.executed).toBe(result.executed);
  });

  it("is monotonic in executed actions as the log grows", async () => {
    const result = await run(shipApiMeeting, { extractor: new MockExtractor(), clock: () => 0, refDate: REF_DATE, approve: () => true });
    let last = 0;
    for (const e of result.events) {
      const view = replay(result.events, e.seq);
      expect(view.executed).toBeGreaterThanOrEqual(last);
      last = view.executed;
    }
  });
});
