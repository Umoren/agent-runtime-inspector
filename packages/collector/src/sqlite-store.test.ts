import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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

  it("compacts legacy tool inventory rows when they are read", () => {
    const database = new DatabaseSync(":memory:");
    const store = createSqliteTraceStore({ database });
    database
      .prepare(
        `INSERT INTO trace_events (id, run_id, type, path, source, timestamp, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "evt_legacy_tools",
        "run_legacy_tools",
        "tool.listed",
        "action",
        "merge",
        "2026-07-17T00:00:00.000Z",
        JSON.stringify({
          toolPackId: "tp_legacy",
          registeredUserId: "ru_legacy",
          tools: [
            {
              name: "github__get_authenticated_user",
              description: "A description that should not leave storage on read.",
              inputSchema: { type: "object", properties: {} }
            }
          ]
        }),
        Date.now()
      );

    const result = store.getRun("run_legacy_tools");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const listed = result.data[0];
      expect(listed?.type).toBe("tool.listed");
      if (listed?.type === "tool.listed") {
        expect(listed.payload.tools).toEqual([{ name: "github__get_authenticated_user" }]);
      }
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
