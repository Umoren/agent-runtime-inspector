import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mockTraceEvents } from "@ari/core";
import { createSqliteTraceStore } from "./sqlite-store.js";

describe("sqlite trace store", () => {
  it("stores and lists mock trace runs", () => {
    const store = createSqliteTraceStore({ path: ":memory:" });
    const result = store.appendEvents(mockTraceEvents);

    expect(result.ok).toBe(true);
    expect(store.listRuns()).toHaveLength(1);
  });

  it("persists events when the store is reopened", () => {
    const directory = mkdtempSync(join(tmpdir(), "ari-collector-"));
    const databasePath = join(directory, "traces.sqlite");
    const firstStore = createSqliteTraceStore({ path: databasePath });

    firstStore.appendEvents(mockTraceEvents);

    const secondStore = createSqliteTraceStore({ path: databasePath });
    const result = secondStore.getRun("mock-run-support-escalation");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(mockTraceEvents.length);
    }
  });
});
