import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TraceEvent } from "@ari/core";
import { createSqliteTraceStore } from "./sqlite-store.js";

describe("sqlite trace store", () => {
  it("stores and lists trace runs", () => {
    const store = createSqliteTraceStore({ path: ":memory:" });
    const result = store.appendEvents(traceEvents);

    expect(result.ok).toBe(true);
    expect(store.listRuns()).toHaveLength(1);
  });

  it("persists events when the store is reopened", () => {
    const directory = mkdtempSync(join(tmpdir(), "ari-collector-"));
    const databasePath = join(directory, "traces.sqlite");
    const firstStore = createSqliteTraceStore({ path: databasePath });

    firstStore.appendEvents(traceEvents);

    const secondStore = createSqliteTraceStore({ path: databasePath });
    const result = secondStore.getRun("run_sqlite_fixture");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(traceEvents.length);
    }
  });
});

const traceEvents: TraceEvent[] = [
  {
    id: "evt_001",
    runId: "run_sqlite_fixture",
    timestamp: "2026-06-15T00:00:00.000Z",
    type: "run.started",
    path: "system",
    source: "collector",
    payload: {
      title: "SQLite fixture"
    }
  }
];
