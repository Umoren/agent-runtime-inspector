import { Hono } from "hono";
import { cors } from "hono/cors";
import { createCollectorLog, errorDetails, type CollectorLog } from "./ops-log.js";
import type { TraceStore } from "./store.js";
import { createMemoryTraceStore } from "./store.js";

export type CollectorAppOptions = {
  store?: TraceStore;
  log?: CollectorLog;
};

export function createCollectorApp(options: CollectorAppOptions = {}) {
  const store = options.store ?? createMemoryTraceStore();
  const log = options.log ?? createCollectorLog();
  const app = new Hono();

  app.use("*", cors());

  log.record({
    level: "info",
    event: "collector.app.started",
    message: "Collector app initialized."
  });

  app.get("/health", (context) => {
    try {
      store.listRuns();

      return context.json({
        ok: true,
        service: "agent-runtime-inspector-collector",
        status: "running",
        storage: {
          state: "readable"
        },
        logCounts: log.counts()
      });
    } catch (error) {
      const entry = log.record({
        level: "error",
        event: "collector.health.storage_unreadable",
        message: "Collector storage could not be read.",
        details: errorDetails(error)
      });

      return context.json(
        {
          ok: false,
          service: "agent-runtime-inspector-collector",
          status: "degraded",
          storage: {
            state: "unreadable"
          },
          logCounts: log.counts(),
          latestError: entry
        },
        200
      );
    }
  });

  app.get("/logs", (context) => {
    const requestedLimit = Number(context.req.query("limit") ?? "50");
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;

    return context.json({
      logs: log.list(limit)
    });
  });

  app.post("/events", async (context) => {
    const body = await readJsonBody(context.req.json.bind(context.req), log);

    if (!body.ok) {
      return context.json(body.error, 400);
    }

    const result = store.appendEvent(body.data);

    if (!result.ok) {
      log.record({
        level: "warn",
        event: "collector.event.rejected",
        message: "Collector rejected an invalid trace event.",
        details: {
          code: result.error.code,
          reason: result.error.message
        }
      });

      return context.json(result.error, 400);
    }

    log.record({
      level: "info",
      event: "collector.event.accepted",
      message: "Collector accepted one trace event.",
      details: {
        runId: result.data.runId,
        type: result.data.type
      }
    });

    return context.json(result.data, 201);
  });

  app.post("/events/batch", async (context) => {
    const body = await readJsonBody(context.req.json.bind(context.req), log);

    if (!body.ok) {
      return context.json(body.error, 400);
    }

    const result = store.appendEvents(body.data);

    if (!result.ok) {
      log.record({
        level: "warn",
        event: "collector.events.rejected",
        message: "Collector rejected an invalid trace event batch.",
        details: {
          code: result.error.code,
          reason: result.error.message
        }
      });

      return context.json(result.error, 400);
    }

    log.record({
      level: "info",
      event: "collector.events.accepted",
      message: "Collector accepted a trace event batch.",
      details: {
        events: result.data.length,
        runIds: [...new Set(result.data.map((event) => event.runId))]
      }
    });

    return context.json(result.data, 201);
  });

  app.delete("/events", (context) => {
    store.clear();
    log.record({
      level: "warn",
      event: "collector.events.cleared",
      message: "Collector trace events were cleared."
    });
    return context.json({ ok: true });
  });

  app.get("/runs", (context) => {
    try {
      return context.json(store.listRuns());
    } catch (error) {
      const entry = log.record({
        level: "error",
        event: "collector.runs.list_failed",
        message: "Collector could not list stored runs.",
        details: errorDetails(error)
      });

      return context.json(
        {
          code: "collector-storage-error",
          message: entry.message,
          logId: entry.id
        },
        500
      );
    }
  });

  app.get("/runs/:runId", (context) => {
    const runId = context.req.param("runId");
    let result: ReturnType<TraceStore["getRun"]>;

    try {
      result = store.getRun(runId);
    } catch (error) {
      const entry = log.record({
        level: "error",
        event: "collector.runs.get_failed",
        message: "Collector could not read a stored run.",
        details: {
          runId,
          ...errorDetails(error)
        }
      });

      return context.json(
        {
          code: "collector-storage-error",
          message: entry.message,
          logId: entry.id
        },
        500
      );
    }

    if (!result.ok) {
      return context.json(result.error, 404);
    }

    return context.json(result.data);
  });

  return app;
}

async function readJsonBody(
  read: () => Promise<unknown>,
  log: CollectorLog
): Promise<
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      error: {
        code: "invalid-json";
        message: string;
      };
    }
> {
  try {
    return {
      ok: true,
      data: await read()
    };
  } catch (error) {
    log.record({
      level: "warn",
      event: "collector.request.invalid_json",
      message: "Collector received a request body that was not valid JSON.",
      details: errorDetails(error)
    });

    return {
      ok: false,
      error: {
        code: "invalid-json",
        message: "Request body must be valid JSON."
      }
    };
  }
}
