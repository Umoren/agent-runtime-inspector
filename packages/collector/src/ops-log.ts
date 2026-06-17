export type CollectorLogLevel = "info" | "warn" | "error";

export type CollectorLogEntry = {
  id: string;
  timestamp: string;
  level: CollectorLogLevel;
  event: string;
  message: string;
  details?: Record<string, unknown>;
};

export type CollectorLog = {
  record(input: {
    level: CollectorLogLevel;
    event: string;
    message: string;
    details?: Record<string, unknown>;
  }): CollectorLogEntry;
  list(limit?: number): CollectorLogEntry[];
  latestError(): CollectorLogEntry | undefined;
  counts(): Record<CollectorLogLevel, number>;
};

export function createCollectorLog(limit = 100): CollectorLog {
  const entries: CollectorLogEntry[] = [];

  return {
    record(input) {
      const entry: CollectorLogEntry = {
        id: `log_${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        level: input.level,
        event: input.event,
        message: input.message,
        ...(input.details ? { details: input.details } : {})
      };

      entries.push(entry);

      if (entries.length > limit) {
        entries.splice(0, entries.length - limit);
      }

      return entry;
    },
    list(requestedLimit) {
      const count = requestedLimit === undefined ? entries.length : Math.max(0, requestedLimit);
      return entries.slice(-count).reverse();
    },
    latestError() {
      return [...entries].reverse().find((entry) => entry.level === "error");
    },
    counts() {
      return {
        info: entries.filter((entry) => entry.level === "info").length,
        warn: entries.filter((entry) => entry.level === "warn").length,
        error: entries.filter((entry) => entry.level === "error").length
      };
    }
  };
}

export function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}
