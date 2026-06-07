import type { TraceEvent, TracePath } from "./events.js";

export type RunStatus = "running" | "success" | "error";

export type PathSummary = {
  path: TracePath;
  totalEvents: number;
  errorCount: number;
};

export type RunSummary = {
  runId: string;
  title: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  totalEvents: number;
  paths: Record<TracePath, PathSummary>;
};

const pathOrder: TracePath[] = ["context", "action", "model", "system"];

export function groupEventsByPath(events: readonly TraceEvent[]): Record<TracePath, TraceEvent[]> {
  return {
    context: events.filter((event) => event.path === "context"),
    action: events.filter((event) => event.path === "action"),
    model: events.filter((event) => event.path === "model"),
    system: events.filter((event) => event.path === "system")
  };
}

export function buildRunSummary(events: readonly TraceEvent[]): RunSummary {
  const firstEvent = events[0];
  const runId = firstEvent?.runId ?? "unknown-run";
  const runStarted = events.find((event) => event.type === "run.started");
  const runCompleted = [...events].reverse().find((event) => event.type === "run.completed");

  const title = runStarted?.type === "run.started" ? runStarted.payload.title : "Untitled agent run";
  const completedAt = runCompleted?.timestamp;
  const status = getRunStatus(events);
  const grouped = groupEventsByPath(events);

  return {
    runId,
    title,
    status,
    startedAt: firstEvent?.timestamp ?? new Date(0).toISOString(),
    ...(completedAt ? { completedAt } : {}),
    totalEvents: events.length,
    paths: Object.fromEntries(
      pathOrder.map((path) => {
        const pathEvents = grouped[path];
        return [
          path,
          {
            path,
            totalEvents: pathEvents.length,
            errorCount: pathEvents.filter(eventHasError).length
          }
        ];
      })
    ) as Record<TracePath, PathSummary>
  };
}

function getRunStatus(events: readonly TraceEvent[]): RunStatus {
  if (events.some(eventHasError)) {
    return "error";
  }

  const completed = [...events].reverse().find((event) => event.type === "run.completed");

  if (completed?.type === "run.completed") {
    return completed.payload.status;
  }

  return "running";
}

function eventHasError(event: TraceEvent): boolean {
  if (event.type === "tool.completed") {
    return event.payload.status === "error" || toolResultIsError(event.payload.result);
  }

  if (event.type === "model.completed") {
    return event.payload.status === "error";
  }

  if (event.type === "tool.blocked") {
    return true;
  }

  if (event.type === "run.completed") {
    return event.payload.status === "error";
  }

  return false;
}

function toolResultIsError(result: unknown): boolean {
  return Boolean(result && typeof result === "object" && (result as { isError?: unknown }).isError === true);
}
