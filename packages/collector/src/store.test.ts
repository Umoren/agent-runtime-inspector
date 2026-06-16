import { describe, expect, it } from "vitest";
import type { TraceEvent } from "@ari/core";
import { createMemoryTraceStore } from "./store.js";

describe("memory trace store", () => {
  it("stores and lists trace runs", () => {
    const store = createMemoryTraceStore();
    const result = store.appendEvents(traceEvents);

    expect(result.ok).toBe(true);
    expect(store.listRuns()).toHaveLength(1);
  });

  it("returns a run by id", () => {
    const store = createMemoryTraceStore(traceEvents);
    const result = store.getRun("run_store_fixture");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(traceEvents.length);
    }
  });
});

const traceEvents: TraceEvent[] = [
  {
    id: "evt_001",
    runId: "run_store_fixture",
    timestamp: "2026-06-15T00:00:00.000Z",
    type: "run.started",
    path: "system",
    source: "collector",
    payload: {
      title: "Store fixture"
    }
  }
];
