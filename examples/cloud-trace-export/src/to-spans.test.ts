import { SpanStatusCode } from "@opentelemetry/api";
import type { TraceEvent } from "@ari/core";
import { describe, expect, it } from "vitest";
import { allowlistEvent } from "./allowlist.js";
import { toSpans } from "./to-spans.js";

const runId = "run_cloud_trace_demo";
const decisionIds = {
  contextDecisionId: "ctx_decision_42",
  permissionSnapshotId: "permission_snapshot_42",
  authorizationDecisionId: "authorization_decision_42",
  authorizationRule: "support_ticket_scope"
};

describe("Cloud Trace allowlist", () => {
  it("keeps sensitive run data out of every serialized span", () => {
    const serialized = JSON.stringify(toSpans(fixtureEvents()));

    expect(serialized).not.toContain("Customer escalation: checkout failure after SSO login");
    expect(serialized).not.toContain("Private finance escalation note");
    expect(serialized).not.toContain("ada.okafor@example.com");
    expect(serialized).not.toContain("Customer account has an unpaid invoice");
    expect(serialized).not.toContain("principal_ada_okafor");
  });

  it("keeps matching decision IDs on context, authorization, and tool spans", () => {
    const spans = toSpans(fixtureEvents()).events;

    for (const eventType of ["context.selected", "authorization.decided", "tool.called"]) {
      const span = spans.find((candidate) => candidate.name === eventType);
      expect(span?.attributes).toMatchObject({
        "ari.context_decision_id": decisionIds.contextDecisionId,
        "ari.permission_snapshot_id": decisionIds.permissionSnapshotId,
        "ari.authorization_decision_id": decisionIds.authorizationDecisionId,
        "ari.authorization_rule": decisionIds.authorizationRule
      });
    }
  });

  it("marks denied authorization as an error and keeps the deny decision", () => {
    const denied = toSpans(fixtureEvents()).events.find((span) => span.name === "authorization.decided");

    expect(denied?.status.code).toBe(SpanStatusCode.ERROR);
    expect(denied?.attributes["ari.decision"]).toBe("deny");
  });

  it("drops an unknown payload field by default", () => {
    const eventWithUnknownField = {
      id: "event_unknown",
      runId,
      timestamp: "2026-11-25T10:00:00.000Z",
      type: "run.started" as const,
      path: "system" as const,
      source: "collector" as const,
      payload: {
        title: "Local title",
        scenario: "cloud_trace_demo",
        unexpectedSecret: "must stay local"
      }
    };

    const result = allowlistEvent(eventWithUnknownField);

    expect(JSON.stringify(result.attributes)).not.toContain("must stay local");
    expect(result.fieldsKeptLocal).toBe(2);
  });
});

function fixtureEvents(): TraceEvent[] {
  return [
    {
      id: "event_started",
      runId,
      timestamp: "2026-11-25T10:00:00.000Z",
      type: "run.started",
      path: "system",
      source: "collector",
      payload: { title: "Codex GitHub MCP run", scenario: "cloud_trace_demo" }
    },
    {
      id: "event_context_selected",
      runId,
      timestamp: "2026-11-25T10:00:01.000Z",
      type: "context.selected",
      path: "context",
      source: "collector",
      payload: {
        ...decisionIds,
        sourceId: "support_ticket_checkout_failure",
        sourceType: "support_ticket",
        title: "Customer escalation: checkout failure after SSO login",
        reason: "The requester can access the support ticket and customer account.",
        permissionRule: "support_team_member"
      }
    },
    {
      id: "event_context_excluded",
      runId,
      timestamp: "2026-11-25T10:00:02.000Z",
      type: "context.excluded",
      path: "context",
      source: "collector",
      payload: {
        sourceId: "private_slack_finance_note",
        sourceType: "slack_message",
        title: "Private finance escalation note",
        reason: "The requester is not a member of the source channel.",
        permissionRule: "source_channel_member"
      }
    },
    {
      id: "event_authorization",
      runId,
      timestamp: "2026-11-25T10:00:03.000Z",
      type: "authorization.decided",
      path: "action",
      source: "policy",
      payload: {
        ...decisionIds,
        principalId: "principal_ada_okafor",
        purpose: "resolve_customer_checkout",
        upstreamId: "github-demo",
        toolName: "linear_create_issue",
        decision: "deny",
        reason: "The recipient is outside the selected conversation.",
        policyId: "email.recipient_must_match_thread",
        policyVersion: "3"
      }
    },
    {
      id: "event_tool_called",
      runId,
      timestamp: "2026-11-25T10:00:04.000Z",
      type: "tool.called",
      path: "action",
      source: "mcp",
      payload: {
        ...decisionIds,
        toolName: "linear_create_issue",
        upstreamId: "github-demo",
        arguments: { customerEmail: "ada.okafor@example.com" }
      }
    },
    {
      id: "event_tool_completed",
      runId,
      timestamp: "2026-11-25T10:00:05.000Z",
      type: "tool.completed",
      path: "action",
      source: "mcp",
      payload: {
        ...decisionIds,
        toolName: "linear_create_issue",
        upstreamId: "github-demo",
        status: "success",
        latencyMs: 250,
        result: { note: "Customer account has an unpaid invoice" }
      }
    },
    {
      id: "event_completed",
      runId,
      timestamp: "2026-11-25T10:00:06.000Z",
      type: "run.completed",
      path: "system",
      source: "collector",
      payload: {
        status: "success",
        summary: "Resolved the customer issue for ada.okafor@example.com"
      }
    }
  ];
}
