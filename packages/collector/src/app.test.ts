import { describe, expect, it } from "vitest";
import { err, ok, type TraceEvent } from "@ari/core";
import { createCollectorApp } from "./app.js";
import type { TraceStore } from "./store.js";

describe("collector app diagnostics", () => {
  it("reports running health without surfacing historical latest errors", async () => {
    const app = createCollectorApp();
    await app.fetch(
      new Request("http://collector.test/events/batch", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify([
          {
            id: "evt_invalid"
          }
        ])
      })
    );

    const healthResponse = await app.fetch(new Request("http://collector.test/health"));
    const health = (await healthResponse.json()) as {
      ok: boolean;
      status: string;
      latestError?: unknown;
    };

    expect(healthResponse.status).toBe(200);
    expect(health.ok).toBe(true);
    expect(health.status).toBe("running");
    expect(health.latestError).toBeUndefined();
  });

  it("records rejected event batches in collector logs", async () => {
    const app = createCollectorApp();
    const rejected = await app.fetch(
      new Request("http://collector.test/events/batch", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify([
          {
            id: "evt_invalid"
          }
        ])
      })
    );

    expect(rejected.status).toBe(400);

    const logs = await readLogs(app);
    expect(logs.logs.some((entry) => entry.event === "collector.events.rejected")).toBe(true);
  });

  it("reports degraded health when stored runs cannot be read", async () => {
    const app = createCollectorApp({ store: unreadableStore() });
    const healthResponse = await app.fetch(new Request("http://collector.test/health"));
    const health = (await healthResponse.json()) as {
      ok: boolean;
      status: string;
      storage: {
        state: string;
      };
      latestError?: {
        event: string;
      };
    };

    expect(healthResponse.status).toBe(200);
    expect(health.ok).toBe(false);
    expect(health.status).toBe("degraded");
    expect(health.storage.state).toBe("unreadable");
    expect(health.latestError?.event).toBe("collector.health.storage_unreadable");

    const runsResponse = await app.fetch(new Request("http://collector.test/runs"));
    expect(runsResponse.status).toBe(500);

    const logs = await readLogs(app);
    expect(logs.logs.some((entry) => entry.event === "collector.runs.list_failed")).toBe(true);
  });
});

type LogsResponse = {
  logs: Array<{
    event: string;
  }>;
};

async function readLogs(app: ReturnType<typeof createCollectorApp>): Promise<LogsResponse> {
  const response = await app.fetch(new Request("http://collector.test/logs"));
  return (await response.json()) as LogsResponse;
}

function unreadableStore(): TraceStore {
  return {
    appendEvent(input: unknown) {
      return ok(input as TraceEvent);
    },
    appendEvents(input: unknown) {
      return ok(input as TraceEvent[]);
    },
    listRuns() {
      throw new Error("Stored trace event evt_000 is invalid.");
    },
    getRun() {
      return err({
        code: "run-not-found",
        message: "No run found."
      });
    },
    clear() {
      return undefined;
    }
  };
}
