import { serve } from "@hono/node-server";
import { createCollectorApp } from "./app.js";
import { createSqliteTraceStore } from "./sqlite-store.js";

export type StartCollectorOptions = {
  port?: number;
  databasePath?: string;
};

export function startCollector(options: StartCollectorOptions = {}) {
  const port = options.port ?? 4319;
  const store = createSqliteTraceStore(options.databasePath ? { path: options.databasePath } : {});
  const app = createCollectorApp({ store });

  return serve({
    fetch: app.fetch,
    port
  });
}
