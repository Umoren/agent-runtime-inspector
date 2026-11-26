import { buildRunSummary, groupEventsByPath, traceEventListSchema } from "@ari/core";
import type { RunSummary, TraceEvent } from "@ari/core";
import { envValue } from "./env";

export type RunMode = "mcp-proxy" | "mcp-action" | "model" | "collector";

export type SystemStatus = {
  collector: "running" | "degraded" | "unreachable";
  collectorUrl: string;
  storage: "local SQLite";
  upstream: UpstreamConfigStatus;
  policy: PolicyConfigStatus;
  collectorHealth: CollectorHealth | undefined;
  collectorLogs: CollectorLogEntry[];
};

export type CollectorHealth = {
  ok: boolean;
  service: string;
  status: "running" | "degraded";
  storage: {
    state: "readable" | "unreadable";
  };
  logCounts: {
    info: number;
    warn: number;
    error: number;
  };
  latestError?: CollectorLogEntry;
};

export type CollectorLogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  details?: Record<string, unknown>;
};

export type UpstreamConfigStatus = {
  state: "configured" | "missing required env";
  required: EnvVarStatus[];
  optional: EnvVarStatus[];
};

export type EnvVarStatus = {
  name: string;
  configured: boolean;
};

export type PolicyConfigStatus = {
  state: "configured" | "default deny";
  required: EnvVarStatus[];
  optional: EnvVarStatus[];
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
      return [];
    }

    const body: unknown = await response.json();
    const parsed = traceEventListSchema.safeParse(body);

    if (!parsed.success) {
      return [];
    }

    return parsed.data;
  } catch {
    return [];
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
  const hasContext = summary.paths.context.totalEvents > 0;
  const hasAction = summary.paths.action.totalEvents > 0;
  const hasModel = summary.paths.model.totalEvents > 0;

  if (hasContext && hasAction) {
    return "mcp-proxy";
  }

  if (hasAction) {
    return "mcp-action";
  }

  if (hasModel) {
    return "model";
  }

  return "collector";
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const upstreamRequired = [
    envStatus("ARI_UPSTREAM_MCP_URL"),
    envStatus("ARI_UPSTREAM_ID"),
    envStatus("ARI_UPSTREAM_TYPE")
  ];
  const missingUpstreamRequired = upstreamRequired.filter((item) => !item.configured);
  const policyRequired = [envStatus("ARI_POLICY_DECISION_URL")];
  const policyConfigured = policyRequired.every((item) => item.configured);
  const collectorHealth = await getCollectorHealth();
  const collectorLogs = await getCollectorLogs();

  return {
    collector: collectorHealth?.status ?? "unreachable",
    collectorUrl: getCollectorUrl(),
    storage: "local SQLite",
    upstream: {
      state: missingUpstreamRequired.length === 0 ? "configured" : "missing required env",
      required: upstreamRequired,
      optional: [
        envStatus("ARI_UPSTREAM_HEADERS_JSON"),
        envStatus("ARI_UPSTREAM_OAUTH_CLIENT_ID"),
        envStatus("ARI_UPSTREAM_OAUTH_CLIENT_SECRET"),
        envStatus("ARI_UPSTREAM_OAUTH_REDIRECT_URL"),
        envStatus("ARI_UPSTREAM_OAUTH_TOKEN_PATH"),
        envStatus("ARI_UPSTREAM_OAUTH_SCOPE")
      ]
    },
    policy: {
      state: policyConfigured ? "configured" : "default deny",
      required: policyRequired,
      optional: [envStatus("ARI_POLICY_HEADERS_JSON")]
    },
    collectorHealth,
    collectorLogs
  };
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
    parts.push(`${String(listedTools.payload.toolCount ?? listedTools.payload.tools.length)} tools reported by the upstream inventory`);
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
  if (events.some(isMcpProxyEvidence)) {
    return "mcp-proxy";
  }

  if (events.some((event) => event.type.startsWith("tool."))) {
    return "mcp-action";
  }

  if (events.some((event) => event.source === "ai-sdk" || event.type.startsWith("model."))) {
    return "model";
  }

  return "collector";
}

function isMcpProxyEvidence(event: TraceEvent): boolean {
  if (event.type === "context.selected" || event.type === "context.excluded") {
    return Boolean(event.payload.contextDecisionId || event.payload.permissionSnapshotId || event.payload.authorizationDecisionId);
  }

  if (event.type === "tool.listed" || event.type === "tool.called" || event.type === "tool.completed" || event.type === "tool.blocked") {
    return Boolean(event.payload.contextDecisionId || event.payload.permissionSnapshotId || event.payload.authorizationDecisionId);
  }

  return false;
}

async function getCollectorHealth(): Promise<CollectorHealth | undefined> {
  try {
    const collectorUrl = getCollectorUrl();
    const response = await fetch(`${collectorUrl}/health`, { cache: "no-store" });

    if (!response.ok) {
      return undefined;
    }

    const body: unknown = await response.json();
    return isCollectorHealth(body) ? body : undefined;
  } catch {
    return undefined;
  }
}

async function getCollectorLogs(): Promise<CollectorLogEntry[]> {
  try {
    const collectorUrl = getCollectorUrl();
    const response = await fetch(`${collectorUrl}/logs?limit=8`, { cache: "no-store" });

    if (!response.ok) {
      return [];
    }

    const body: unknown = await response.json();

    if (!isRecord(body) || !Array.isArray(body.logs)) {
      return [];
    }

    return body.logs.filter(isCollectorLogEntry);
  } catch {
    return [];
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

function isCollectorHealth(input: unknown): input is CollectorHealth {
  if (!isRecord(input)) {
    return false;
  }

  return (
    typeof input.ok === "boolean" &&
    input.service === "agent-runtime-inspector-collector" &&
    (input.status === "running" || input.status === "degraded") &&
    isRecord(input.storage) &&
    (input.storage.state === "readable" || input.storage.state === "unreadable") &&
    isRecord(input.logCounts) &&
    typeof input.logCounts.info === "number" &&
    typeof input.logCounts.warn === "number" &&
    typeof input.logCounts.error === "number" &&
    (input.latestError === undefined || isCollectorLogEntry(input.latestError))
  );
}

function isCollectorLogEntry(input: unknown): input is CollectorLogEntry {
  if (!isRecord(input)) {
    return false;
  }

  return (
    typeof input.id === "string" &&
    typeof input.timestamp === "string" &&
    (input.level === "info" || input.level === "warn" || input.level === "error") &&
    typeof input.event === "string" &&
    typeof input.message === "string" &&
    (input.details === undefined || isRecord(input.details))
  );
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}
