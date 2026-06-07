import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { buildRunSummary, traceEventListSchema, traceEventSchema } from "@ari/core";
import type { TraceEvent } from "@ari/core";
import { err, ok } from "@ari/core";
import type { TraceStore } from "./store.js";

type SqliteTraceStoreOptions = {
  path?: string;
  database?: DatabaseSync;
};

type TraceEventRow = {
  id: string;
  run_id: string;
  type: string;
  path: string;
  source: string;
  timestamp: string;
  payload_json: string;
};

const defaultDatabasePath = ".ari/traces.sqlite";

export function createSqliteTraceStore(options: SqliteTraceStoreOptions = {}): TraceStore {
  const database = options.database ?? openDatabase(options.path ?? process.env.ARI_SQLITE_PATH ?? defaultDatabasePath);

  migrate(database);

  return {
    appendEvent(input) {
      const parsed = traceEventSchema.safeParse(input);

      if (!parsed.success) {
        return err({
          code: "invalid-event",
          message: parsed.error.message
        });
      }

      insertEvent(database, parsed.data);
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

      database.exec("BEGIN IMMEDIATE");
      try {
        for (const event of parsed.data) {
          insertEvent(database, event);
        }
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }

      return ok(parsed.data);
    },
    listRuns() {
      const rows = database
        .prepare("SELECT id, run_id, type, path, source, timestamp, payload_json FROM trace_events ORDER BY timestamp ASC, created_at ASC")
        .all() as TraceEventRow[];
      const eventsByRun = new Map<string, TraceEvent[]>();

      for (const row of rows) {
        const event = parseRow(row);
        const existing = eventsByRun.get(event.runId) ?? [];
        existing.push(event);
        eventsByRun.set(event.runId, existing);
      }

      return [...eventsByRun.values()].map((runEvents) => buildRunSummary(runEvents));
    },
    getRun(runId) {
      const rows = database
        .prepare(
          "SELECT id, run_id, type, path, source, timestamp, payload_json FROM trace_events WHERE run_id = ? ORDER BY timestamp ASC, created_at ASC"
        )
        .all(runId) as TraceEventRow[];

      if (rows.length === 0) {
        return err({
          code: "run-not-found",
          message: `No run found for ${runId}`
        });
      }

      return ok(rows.map(parseRow));
    },
    clear() {
      database.prepare("DELETE FROM trace_events").run();
    }
  };
}

function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  return new DatabaseSync(path);
}

function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS trace_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      source TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS trace_events_run_id_idx ON trace_events(run_id);
    CREATE INDEX IF NOT EXISTS trace_events_timestamp_idx ON trace_events(timestamp);
  `);
}

function insertEvent(database: DatabaseSync, event: TraceEvent): void {
  database
    .prepare(
      `
      INSERT OR REPLACE INTO trace_events (
        id,
        run_id,
        type,
        path,
        source,
        timestamp,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      event.id,
      event.runId,
      event.type,
      event.path,
      event.source,
      event.timestamp,
      JSON.stringify(event.payload),
      Date.now()
    );
}

function parseRow(row: TraceEventRow): TraceEvent {
  const parsed = traceEventSchema.safeParse({
    id: row.id,
    runId: row.run_id,
    type: row.type,
    path: row.path,
    source: row.source,
    timestamp: row.timestamp,
    payload: JSON.parse(row.payload_json) as unknown
  });

  if (!parsed.success) {
    throw new Error(`Stored trace event ${row.id} is invalid: ${parsed.error.message}`);
  }

  return parsed.data;
}
