import { MockExtractor, run, REF_DATE } from "@/engine";
import type { ApprovalContext, LoggedEvent } from "@/engine";
import { saveRun } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events endpoint that streams a meeting run live: each transcript line, extracted
 * decision, detected task, approval decision and executed action is pushed as it happens. The
 * run uses the deterministic mock extractor and mock providers, so no API keys are needed.
 *
 * Query params: title, transcript (newline-separated), approve ("1" to auto-approve external
 * actions - destructive ones are still denied by the policy gate).
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const title = url.searchParams.get("title") ?? "Meeting";
  const transcript = (url.searchParams.get("transcript") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const approveExternal = url.searchParams.get("approve") === "1";

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: LoggedEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      const result = await run(
        { title, transcript: transcript.length ? transcript : ["Let's ship the new API by Friday."] },
        {
          extractor: new MockExtractor(),
          refDate: REF_DATE,
          approve: (_ctx: ApprovalContext) => approveExternal,
          onEvent: send,
        },
      );

      saveRun({ id: String(result.runId), title, status: result.status, executed: result.executed, events: result.events });

      controller.enqueue(
        encoder.encode(`event: done\ndata: ${JSON.stringify({ runId: result.runId, status: result.status, executed: result.executed })}\n\n`),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
