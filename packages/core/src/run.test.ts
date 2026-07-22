import { describe, expect, it } from "vitest";
import type { TraceEvent } from "./events.js";
import { buildRunSummary, groupEventsByPath } from "./run.js";

describe("run aggregation", () => {
  it("builds a summary from trace events", () => {
    const summary = buildRunSummary(traceEvents);

    expect(summary.runId).toBe("run_permission_fixture");
    expect(summary.status).toBe("success");
    expect(summary.paths.action.totalEvents).toBe(4);
    expect(summary.paths.context.totalEvents).toBe(2);
  });

  it("groups events by path", () => {
    const grouped = groupEventsByPath(traceEvents);

    expect(grouped.system).toHaveLength(2);
    expect(grouped.action.map((event) => event.type)).toEqual([
      "authorization.decided",
      "tool.listed",
      "tool.called",
      "tool.completed"
    ]);
  });

  it("binds action events to the selected context decision", () => {
    const grouped = groupEventsByPath(traceEvents);
    const selectedContextDecisionIds = grouped.context.flatMap((event) => {
      if (event.type !== "context.selected") {
        return [];
      }

      return event.payload.contextDecisionId ? [event.payload.contextDecisionId] : [];
    });
    const calledActionDecisionIds = grouped.action.flatMap((event) => {
      if (event.type !== "tool.called") {
        return [];
      }

      return event.payload.contextDecisionId ? [event.payload.contextDecisionId] : [];
    });

    expect(new Set(selectedContextDecisionIds)).toEqual(new Set(["ctx_permission_fixture"]));
    expect(new Set(calledActionDecisionIds)).toEqual(new Set(["ctx_permission_fixture"]));
  });
});

const traceEvents: TraceEvent[] = [
  {
    id: "evt_001",
    runId: "run_permission_fixture",
    timestamp: "2026-06-15T00:00:00.000Z",
    type: "run.started",
    path: "system",
    source: "collector",
    payload: {
      title: "Permission-linked MCP run"
    }
  },
  {
    id: "evt_002",
    runId: "run_permission_fixture",
    timestamp: "2026-06-15T00:00:01.000Z",
    type: "context.selected",
    path: "context",
    source: "collector",
    payload: {
      permissionSnapshotId: "perm_permission_fixture",
      contextDecisionId: "ctx_permission_fixture",
      sourceId: "docs_public",
      sourceType: "project_doc",
      title: "Public project docs",
      reason: "Allowed project context for the tool call.",
      permissionRule: "project_read"
    }
  },
  {
    id: "evt_003",
    runId: "run_permission_fixture",
    timestamp: "2026-06-15T00:00:02.000Z",
    type: "context.excluded",
    path: "context",
    source: "collector",
    payload: {
      permissionSnapshotId: "perm_permission_fixture",
      contextDecisionId: "ctx_permission_fixture",
      sourceId: "secret_env",
      sourceType: "secret_file",
      title: ".env",
      reason: "Credential material is outside the allowed context.",
      permissionRule: "no_secret_material"
    }
  },
  {
    id: "evt_004",
    runId: "run_permission_fixture",
    timestamp: "2026-06-15T00:00:03.000Z",
    type: "authorization.decided",
    path: "action",
    source: "policy",
    payload: {
      permissionSnapshotId: "perm_permission_fixture",
      contextDecisionId: "ctx_permission_fixture",
      authorizationDecisionId: "auth_permission_fixture",
      authorizationRule: "project_context_allows_tool_call",
      principalId: "samuel",
      purpose: "project_issue_management",
      upstreamId: "github",
      toolName: "github__create_issue",
      decision: "allow",
      reason: "The project issue policy allows this action.",
      policyId: "project_context_allows_tool_call"
    }
  },
  {
    id: "evt_005",
    runId: "run_permission_fixture",
    timestamp: "2026-06-15T00:00:04.000Z",
    type: "tool.listed",
    path: "action",
    source: "merge",
    payload: {
      permissionSnapshotId: "perm_permission_fixture",
      contextDecisionId: "ctx_permission_fixture",
      authorizationDecisionId: "auth_permission_fixture",
      authorizationRule: "project_context_allows_tool_call",
      toolPackId: "tp_fixture",
      registeredUserId: "ru_fixture",
      tools: [{ name: "github__create_issue" }]
    }
  },
  {
    id: "evt_006",
    runId: "run_permission_fixture",
    timestamp: "2026-06-15T00:00:05.000Z",
    type: "tool.called",
    path: "action",
    source: "merge",
    payload: {
      permissionSnapshotId: "perm_permission_fixture",
      contextDecisionId: "ctx_permission_fixture",
      authorizationDecisionId: "auth_permission_fixture",
      authorizationRule: "project_context_allows_tool_call",
      toolPackId: "tp_fixture",
      registeredUserId: "ru_fixture",
      toolName: "github__create_issue",
      arguments: { title: "Permission audit" },
      correlationId: "corr_fixture"
    }
  },
  {
    id: "evt_007",
    runId: "run_permission_fixture",
    timestamp: "2026-06-15T00:00:06.000Z",
    type: "tool.completed",
    path: "action",
    source: "merge",
    payload: {
      permissionSnapshotId: "perm_permission_fixture",
      contextDecisionId: "ctx_permission_fixture",
      authorizationDecisionId: "auth_permission_fixture",
      authorizationRule: "project_context_allows_tool_call",
      toolName: "github__create_issue",
      status: "success",
      latencyMs: 42,
      result: { issueId: "ISSUE-1" },
      correlationId: "corr_fixture"
    }
  },
  {
    id: "evt_008",
    runId: "run_permission_fixture",
    timestamp: "2026-06-15T00:00:07.000Z",
    type: "run.completed",
    path: "system",
    source: "collector",
    payload: {
      status: "success"
    }
  }
];
