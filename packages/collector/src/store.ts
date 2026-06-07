import { buildRunSummary, traceEventListSchema, traceEventSchema } from "@ari/core";
import type { Result, RunSummary, TraceEvent } from "@ari/core";
import { err, ok } from "@ari/core";

export type StoreError =
  | {
      code: "invalid-event";
      message: string;
    }
  | {
      code: "run-not-found";
      message: string;
    };

export type TraceStore = {
  appendEvent(input: unknown): Result<TraceEvent, StoreError>;
  appendEvents(input: unknown): Result<TraceEvent[], StoreError>;
  listRuns(): RunSummary[];
  getRun(runId: string): Result<TraceEvent[], StoreError>;
  clear(): void;
};

export function createMemoryTraceStore(initialEvents: readonly TraceEvent[] = []): TraceStore {
  const events: TraceEvent[] = [...initialEvents];

  return {
    appendEvent(input) {
      const parsed = traceEventSchema.safeParse(input);

      if (!parsed.success) {
        return err({
          code: "invalid-event",
          message: parsed.error.message
        });
      }

      events.push(parsed.data);
      return ok(parsed.data);
    },
    appendEvents(input) {
      const parsed = traceEventListSchema.safeParse(input);

      if (!parsed.success) {
        return err({
          code: "invalid-event",
          message: parsed.error.message
        });
      }

      events.push(...parsed.data);
      return ok(parsed.data);
    },
    listRuns() {
      const eventsByRun = new Map<string, TraceEvent[]>();

      for (const event of events) {
        const existing = eventsByRun.get(event.runId) ?? [];
        existing.push(event);
        eventsByRun.set(event.runId, existing);
      }

      return [...eventsByRun.values()].map((runEvents) => buildRunSummary(sortEvents(runEvents)));
    },
    getRun(runId) {
      const runEvents = events.filter((event) => event.runId === runId);

      if (runEvents.length === 0) {
        return err({
          code: "run-not-found",
          message: `No run found for ${runId}`
        });
      }

      return ok(sortEvents(runEvents));
    },
    clear() {
      events.length = 0;
    }
  };
}

function sortEvents(events: readonly TraceEvent[]): TraceEvent[] {
  return [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
