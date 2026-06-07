import { describe, expect, it } from "vitest";
import { mockTraceEvents } from "./mock-trace.js";
import { buildRunSummary, groupEventsByPath } from "./run.js";

describe("run aggregation", () => {
  it("builds a summary from trace events", () => {
    const summary = buildRunSummary(mockTraceEvents);

    expect(summary.runId).toBe("mock-run-support-escalation");
    expect(summary.status).toBe("success");
    expect(summary.paths.action.totalEvents).toBe(3);
    expect(summary.paths.context.totalEvents).toBe(2);
    expect(summary.paths.model.totalEvents).toBe(2);
  });

  it("groups events by path", () => {
    const grouped = groupEventsByPath(mockTraceEvents);

    expect(grouped.system).toHaveLength(2);
    expect(grouped.action.map((event) => event.type)).toEqual([
      "tool.listed",
      "tool.called",
      "tool.completed"
    ]);
  });
});
