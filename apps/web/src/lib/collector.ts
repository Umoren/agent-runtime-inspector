import { buildRunSummary, groupEventsByPath, mockTraceEvents, traceEventListSchema } from "@ari/core";
import type { RunSummary, TraceEvent } from "@ari/core";
import { envValue } from "./env";

export type RunMode = "mock" | "connected" | "unknown";

export type SystemStatus = {
  collector: "running" | "unreachable";
  collectorUrl: string;
  storage: "local SQLite";
  merge: MergeConfigStatus;
  model: ModelConfigStatus;
  mockTrace: "available";
};

export type MergeConfigStatus = {
  state: "configured" | "missing required env";
  required: EnvVarStatus[];
  optional: EnvVarStatus[];
};

export type EnvVarStatus = {
  name: string;
  configured: boolean;
};

export type ModelConfigStatus = {
  state: "configured" | "manual fallback";
  required: EnvVarStatus[];
  optional: EnvVarStatus[];
};

export type MockLoadResult = {
  runId: string;
  events: number;
};

export async function getRuns(): Promise<RunSummary[]> {
  try {
    const collectorUrl = getCollectorUrl();
    const response = await fetch(`${collectorUrl}/runs`, { cache: "no-store" });

    if (!response.ok) {
      return [];
    }

    const body: unknown = await response.json();
    const runs = runSummaryListSchema.safeParse(body);

    if (!runs.success) {
      return [];
    }

    return [...runs.data].sort((left, right) => runTimeMs(right) - runTimeMs(left));
  } catch {
    return [];
  }
}

export async function getRunEvents(runId: string): Promise<TraceEvent[]> {
  try {
    const collectorUrl = getCollectorUrl();
    const response = await fetch(`${collectorUrl}/runs/${runId}`, { cache: "no-store" });

    if (!response.ok) {
      return mockTraceEvents;
    }

    const body: unknown = await response.json();
    const parsed = traceEventListSchema.safeParse(body);

    if (!parsed.success) {
      return mockTraceEvents;
    }

    return parsed.data;
  } catch {
    return mockTraceEvents;
  }
}

export function buildDashboardModel(events: readonly TraceEvent[]) {
  return {
    summary: buildRunSummary(events),
    grouped: groupEventsByPath(events),
    raw: events,
    explanation: explainRun(events),
    mode: getRunMode(events)
  };
}

export function getSummaryMode(summary: RunSummary): RunMode {
  if (summary.runId.startsWith("mock-")) {
    return "mock";
  }

  const title = summary.title.toLowerCase();

  if (title.includes("merge agent handler") || title.includes("ari mcp proxy")) {
    return "connected";
  }

  return "unknown";
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const required = [
    envStatus("MERGE_AGENT_HANDLER_MCP_URL"),
    envStatus("MERGE_REGISTERED_USER_ID"),
    envStatus("MERGE_TOOL_PACK_ID"),
    envStatus("MERGE_API_KEY")
  ];
  const optional = [
    envStatus("MERGE_TOOL_NAME"),
    envStatus("MERGE_TOOL_ARGUMENTS_JSON"),
    envStatus("ARI_AGENT_WORKFLOW"),
    envStatus("ARI_GITHUB_OWNER"),
    envStatus("ARI_GITHUB_REPO"),
    envStatus("ARI_GITHUB_LABELS_JSON")
  ];
  const missingRequired = required.filter((item) => !item.configured);
  const modelRequired = [envStatus("ARI_MODEL_API_KEY"), envStatus("ARI_MODEL_NAME")];
  const missingModelRequired = modelRequired.filter((item) => !item.configured);

  return {
    collector: (await canReachCollector()) ? "running" : "unreachable",
    collectorUrl: getCollectorUrl(),
    storage: "local SQLite",
    merge: {
      state: missingRequired.length === 0 ? "configured" : "missing required env",
      required,
      optional
    },
    model: {
      state: missingModelRequired.length === 0 ? "configured" : "manual fallback",
      required: modelRequired,
      optional: [envStatus("ARI_MODEL_PROVIDER"), envStatus("ARI_MODEL_BASE_URL"), envStatus("ARI_MODEL_PROMPT")]
    },
    mockTrace: "available"
  };
}

export async function loadMockTrace(): Promise<MockLoadResult> {
  const collectorUrl = getCollectorUrl();
  const response = await fetch(`${collectorUrl}/mock`, {
    method: "POST",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Collector rejected mock trace: ${String(response.status)} ${response.statusText}`);
  }

  const body: unknown = await response.json();

  if (!isMockLoadResult(body)) {
    throw new Error("Collector returned an invalid mock trace response.");
  }

  return body;
}

function explainRun(events: readonly TraceEvent[]): string {
  const completed = [...events].reverse().find((event) => event.type === "run.completed");

  if (completed?.type === "run.completed" && completed.payload.summary) {
    return completed.payload.summary;
  }

  const selectedContext = events.filter((event) => event.type === "context.selected").length;
  const excludedContext = events.filter((event) => event.type === "context.excluded").length;
  const listedTools = events.find((event) => event.type === "tool.listed");
  const calledTool = events.find((event) => event.type === "tool.called");
  const completedTool = events.find((event) => event.type === "tool.completed");
  const completedModel = events.find((event) => event.type === "model.completed");

  const parts: string[] = [];

  if (selectedContext > 0 || excludedContext > 0) {
    parts.push(`${String(selectedContext)} context source selected and ${String(excludedContext)} source excluded`);
  }

  if (listedTools?.type === "tool.listed") {
    parts.push(`${String(listedTools.payload.tools.length)} tools exposed to the agent`);
  }

  if (calledTool?.type === "tool.called") {
    parts.push(`the agent called ${calledTool.payload.toolName}`);
  }

  if (completedTool?.type === "tool.completed") {
    parts.push(`the tool returned ${completedTool.payload.status}`);
  }

  if (completedModel?.type === "model.completed") {
    parts.push(`${completedModel.payload.provider}/${completedModel.payload.model} completed the model step`);
  }

  if (parts.length === 0) {
    return "This run has events recorded, but no context, action, or model details yet.";
  }

  return `This run recorded ${parts.join(", ")}.`;
}

function getRunMode(events: readonly TraceEvent[]): RunMode {
  const started = events.find((event) => event.type === "run.started");
  const runId = events[0]?.runId ?? "";

  if (runId.startsWith("mock-") || started?.source === "mock") {
    return "mock";
  }

  if (
    started?.type === "run.started" &&
    (started.payload.title.toLowerCase().includes("merge agent handler") ||
      started.payload.title.toLowerCase().includes("ari mcp proxy"))
  ) {
    return "connected";
  }

  return "unknown";
}

async function canReachCollector(): Promise<boolean> {
  try {
    const collectorUrl = getCollectorUrl();
    const response = await fetch(`${collectorUrl}/health`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

const runSummaryListSchema = {
  safeParse(input: unknown) {
    if (!Array.isArray(input)) {
      return { success: false as const };
    }

    return { success: true as const, data: input as RunSummary[] };
  }
};

function isMockLoadResult(input: unknown): input is MockLoadResult {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  return typeof candidate.runId === "string" && typeof candidate.events === "number";
}

function envStatus(name: string): EnvVarStatus {
  return {
    name,
    configured: Boolean(envValue(name))
  };
}

function getCollectorUrl(): string {
  return envValue("ARI_COLLECTOR_URL") ?? "http://localhost:4319";
}

function runTimeMs(run: RunSummary): number {
  const value = run.completedAt ?? run.startedAt;
  const time = Date.parse(value);

  return Number.isNaN(time) ? 0 : time;
}
