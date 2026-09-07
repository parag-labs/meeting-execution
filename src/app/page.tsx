"use client";

import { useCallback, useMemo, useRef, useState } from "react";

interface LoggedEvent {
  seq: number;
  event: { type: string; [k: string]: unknown };
}

const SAMPLE = `Alright, let's ship the new API by Friday.
Engineering should create the GitHub issue to track it.
Design will schedule the review on Monday.
Someone notify the team on Slack once it's live.`;

function tagClass(type: string): string {
  if (type === "TranscriptReceived") return "speak";
  if (type.startsWith("Approval")) return "approval";
  if (type === "ActionRejected" || type === "RunFailed") return "reject";
  if (type === "ActionCompleted" || type === "RunCompleted") return "ok";
  return "info";
}

function describe(e: LoggedEvent["event"]): string {
  switch (e.type) {
    case "RunStarted":
      return `meeting: ${e.title as string}`;
    case "TranscriptReceived":
      return e.line as string;
    case "IntentExtracted":
      return `${e.decisions as number} decisions, ${e.tasks as number} tasks (${e.tokens as number} tokens)`;
    case "DecisionDetected":
      return `${e.statement as string} — ${e.owner as string}${e.deadline ? `, due ${e.deadline as string}` : ""}`;
    case "TaskDetected":
      return `${e.title as string} → ${e.kind as string} (${e.owner as string})`;
    case "ApprovalRequested":
      return `approval needed (${e.effect as string}) for ${e.kind as string}`;
    case "ApprovalDecided":
      return `approval ${e.approved ? "granted" : "denied"}`;
    case "ActionRequested":
      return `executing via ${e.provider as string}`;
    case "ActionCompleted":
      return `${e.provider as string} ${e.ref as string}: ${e.detail as string}`;
    case "ActionRejected":
      return `rejected: ${e.reason as string}`;
    case "RunPaused":
      return e.reason as string;
    case "RunCompleted":
      return `status: ${e.status as string}`;
    case "RunFailed":
      return e.error as string;
    default:
      return "";
  }
}

export default function Page() {
  const [transcript, setTranscript] = useState(SAMPLE);
  const [approve, setApprove] = useState(false);
  const [events, setEvents] = useState<LoggedEvent[]>([]);
  const [running, setRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const start = useCallback(() => {
    esRef.current?.close();
    setEvents([]);
    setRunning(true);

    const params = new URLSearchParams({ title: "Meeting", transcript, approve: approve ? "1" : "0" });
    const es = new EventSource(`/api/meeting/stream?${params.toString()}`);
    esRef.current = es;

    es.onmessage = (msg) => setEvents((prev) => [...prev, JSON.parse(msg.data) as LoggedEvent]);
    es.addEventListener("done", () => {
      setRunning(false);
      es.close();
    });
    es.onerror = () => {
      setRunning(false);
      es.close();
    };
  }, [transcript, approve]);

  const decisions = useMemo(() => events.filter((e) => e.event.type === "DecisionDetected"), [events]);
  const actions = useMemo(
    () => events.filter((e) => e.event.type === "ActionCompleted" || e.event.type === "ActionRejected"),
    [events],
  );

  return (
    <main>
      <h1>Meeting → Execution</h1>
      <p className="sub">Transcripts become decisions, owners, deadlines and executed actions. The model extracts and proposes; deterministic code validates and executes; external actions wait for approval.</p>

      <div className="panel">
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} aria-label="Transcript" />
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <label>
            <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} /> approve external actions
          </label>
          <button onClick={start} disabled={running}>
            {running ? "Running…" : "Run meeting"}
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <h2>Decisions</h2>
          {decisions.length === 0 && <div className="owner">No decisions yet.</div>}
          {decisions.map((e) => (
            <div className="item" key={e.seq}>
              {e.event.statement as string}
              <div className="owner">
                {e.event.owner as string}
                {e.event.deadline ? ` · due ${e.event.deadline as string}` : ""}
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Actions</h2>
          {actions.length === 0 && <div className="owner">No actions executed yet.</div>}
          {actions.map((e) => (
            <div className="item" key={e.seq}>
              <span className={`tag ${tagClass(e.event.type)}`}>{e.event.type === "ActionCompleted" ? "done" : "rejected"}</span>{" "}
              {describe(e.event)}
            </div>
          ))}
        </div>
      </div>

      {events.length > 0 && (
        <div className="panel">
          <h2>Event stream</h2>
          {events.map((e) => (
            <div className="event" key={e.seq}>
              <span className={`tag ${tagClass(e.event.type)}`}>{e.event.type}</span>
              <span>{describe(e.event)}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
