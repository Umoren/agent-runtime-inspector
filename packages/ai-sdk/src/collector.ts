import type { TraceEvent } from "@ari/core";

export type EventRecorder = {
  record(event: TraceEvent): Promise<void>;
};

export type HttpRecorderOptions = {
  collectorUrl?: string;
};

export function createHttpRecorder(options: HttpRecorderOptions = {}): EventRecorder {
  const collectorUrl = options.collectorUrl ?? process.env.ARI_COLLECTOR_URL ?? "http://localhost:4319";

  return {
    async record(event) {
      const response = await fetch(`${collectorUrl}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        throw new Error(`Collector rejected event ${event.type}: ${response.status} ${response.statusText}`);
      }
    }
  };
}
