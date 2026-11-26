import { SpanStatusCode } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { cloudTraceTimestampIssue } from "./cloud-trace-window.js";
import type { SpanDefinition } from "./to-spans.js";

const now = new Date("2026-11-26T12:00:00.000Z").getTime();

describe("Cloud Trace timestamp window", () => {
  it("rejects spans older than 14 days", () => {
    expect(cloudTraceTimestampIssue([span("2026-11-11T11:59:59.999Z")], now)).toBe("too-old");
  });

  it("rejects spans more than 3 days in the future", () => {
    expect(cloudTraceTimestampIssue([span("2026-11-29T12:00:00.001Z")], now)).toBe("too-far-ahead");
  });

  it("accepts spans inside the Cloud Trace time window", () => {
    expect(cloudTraceTimestampIssue([span("2026-11-20T12:00:00.000Z")], now)).toBeUndefined();
  });
});

function span(timestamp: string): SpanDefinition {
  const time = new Date(timestamp);

  return {
    name: "ari.run",
    startTime: time,
    endTime: time,
    attributes: {},
    status: { code: SpanStatusCode.UNSET }
  };
}
