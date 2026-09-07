import { listRuns } from "@/lib/store";

export const dynamic = "force-dynamic";

/** List persisted runs (most recent first) for the history panel. */
export async function GET(): Promise<Response> {
  const runs = listRuns()
    .map((r) => ({ id: r.id, title: r.title, status: r.status, executed: r.executed, events: r.events.length }))
    .reverse();
  return Response.json({ runs });
}
