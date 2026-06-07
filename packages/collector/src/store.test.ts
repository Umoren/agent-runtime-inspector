import { describe, expect, it } from "vitest";
import { mockTraceEvents } from "@ari/core";
import { createMemoryTraceStore } from "./store.js";

describe("memory trace store", () => {
  it("stores and lists mock trace runs", () => {
    const store = createMemoryTraceStore();
    const result = store.appendEvents(mockTraceEvents);

    expect(result.ok).toBe(true);
    expect(store.listRuns()).toHaveLength(1);
  });

  it("returns a run by id", () => {
    const store = createMemoryTraceStore(mockTraceEvents);
    const result = store.getRun("mock-run-support-escalation");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(mockTraceEvents.length);
    }
  });
});
