import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const traceEventsTable = sqliteTable("trace_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  source: text("source").notNull(),
  timestamp: text("timestamp").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});
