import { SpanStatusCode, type Attributes } from "@opentelemetry/api";
import type { TraceEvent } from "@ari/core";
import { allowlistEvent } from "./allowlist.js";

export type SpanDefinition = {
  name: string;
  startTime: Date;
  endTime: Date;
  attributes: Attributes;
  status: { code: SpanStatusCode };
  fieldsKept?: number;
  fieldsKeptLocal?: number;
};

export type RunSpans = {
  root: SpanDefinition;
  events: SpanDefinition[];
};

export function toSpans(events: readonly TraceEvent[]): RunSpans {
  if (events.length === 0) {
    throw new Error("The run has no events.");
  }

  const first = events[0];
  const last = events.at(-1);

  if (!first || !last) {
    throw new Error("The run has no events.");
  }

  return {
    root: {
      name: "ari.run",
      startTime: new Date(first.timestamp),
      endTime: new Date(last.timestamp),
      attributes: {},
      status: { code: SpanStatusCode.UNSET }
    },
    events: events.map(toEventSpan)
  };
}

function toEventSpan(event: TraceEvent): SpanDefinition {
  const endTime = new Date(event.timestamp);
  const durationMs = completedLatency(event);
  const allowlisted = allowlistEvent(event);

  return {
    name: event.type,
    startTime: new Date(endTime.getTime() - durationMs),
    endTime,
    attributes: allowlisted.attributes,
    status: { code: isError(event) ? SpanStatusCode.ERROR : SpanStatusCode.UNSET },
    fieldsKept: allowlisted.fieldsKept,
    fieldsKeptLocal: allowlisted.fieldsKeptLocal
  };
}

function completedLatency(event: TraceEvent): number {
  switch (event.type) {
    case "tool.completed":
    case "model.completed":
      return event.payload.latencyMs;
    default:
      return 0;
  }
}

function isError(event: TraceEvent): boolean {
  switch (event.type) {
    case "tool.completed":
    case "model.completed":
    case "run.completed":
      return event.payload.status === "error";
    case "tool.blocked":
      return true;
    case "authorization.decided":
      return event.payload.decision === "deny";
    default:
      return false;
  }
}
