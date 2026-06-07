import { Hono } from "hono";
import { cors } from "hono/cors";
import { mockTraceEvents } from "@ari/core";
import type { TraceStore } from "./store.js";
import { createMemoryTraceStore } from "./store.js";

export type CollectorAppOptions = {
  store?: TraceStore;
};

export function createCollectorApp(options: CollectorAppOptions = {}) {
  const store = options.store ?? createMemoryTraceStore();
  const app = new Hono();

  app.use("*", cors());

  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: "agent-runtime-inspector-collector"
    })
  );

  app.post("/events", async (context) => {
    const body: unknown = await context.req.json();
    const result = store.appendEvent(body);

    if (!result.ok) {
      return context.json(result.error, 400);
    }

    return context.json(result.data, 201);
  });

  app.post("/events/batch", async (context) => {
    const body: unknown = await context.req.json();
    const result = store.appendEvents(body);

    if (!result.ok) {
      return context.json(result.error, 400);
    }

    return context.json(result.data, 201);
  });

  app.post("/mock", (context) => {
    const result = store.appendEvents(mockTraceEvents);

    if (!result.ok) {
      return context.json(result.error, 400);
    }

    return context.json({
      runId: mockTraceEvents[0]?.runId,
      events: result.data.length
    });
  });

  app.delete("/events", (context) => {
    store.clear();
    return context.json({ ok: true });
  });

  app.get("/runs", (context) => context.json(store.listRuns()));

  app.get("/runs/:runId", (context) => {
    const runId = context.req.param("runId");
    const result = store.getRun(runId);

    if (!result.ok) {
      return context.json(result.error, 404);
    }

    return context.json(result.data);
  });

  return app;
}
