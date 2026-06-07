import type { TraceEvent } from "./events.js";

const runId = "mock-run-support-escalation";
const timestampBase = Date.parse("2026-06-05T12:00:00.000Z");

export const mockTraceEvents: TraceEvent[] = [
  event(0, {
    type: "run.started",
    path: "system",
    source: "mock",
    payload: {
      title: "Support escalation to Linear issue",
      userId: "user_support_lead",
      scenario: "A support lead asks an agent to draft an engineering issue from a customer escalation."
    }
  }),
  event(1, {
    type: "context.selected",
    path: "context",
    source: "mock",
    payload: {
      sourceId: "ticket_1827",
      sourceType: "support_ticket",
      title: "Customer escalation: SSO login failure",
      reason: "The ticket is linked to the customer account and visible to the requesting user.",
      permissionRule: "support_team_member"
    }
  }),
  event(2, {
    type: "context.excluded",
    path: "context",
    source: "mock",
    payload: {
      sourceId: "slack_private_44",
      sourceType: "slack_message",
      title: "Private escalation note",
      reason: "The user is not a member of the source channel.",
      permissionRule: "source_channel_member"
    }
  }),
  event(3, {
    type: "model.called",
    path: "model",
    source: "ai-sdk",
    payload: {
      taskType: "issue_draft",
      provider: "openai",
      model: "gpt-4.1-mini",
      routeReason: "Drafting task with moderate context size."
    }
  }),
  event(4, {
    type: "model.completed",
    path: "model",
    source: "ai-sdk",
    payload: {
      provider: "openai",
      model: "gpt-4.1-mini",
      status: "success",
      latencyMs: 842,
      inputTokens: 1210,
      outputTokens: 318,
      estimatedCostUsd: 0.0032
    }
  }),
  event(5, {
    type: "tool.listed",
    path: "action",
    source: "merge",
    payload: {
      toolPackId: "tp_support_agent",
      registeredUserId: "ru_support_lead",
      tools: [
        {
          name: "linear_create_issue",
          description: "Create a Linear issue in an authorized workspace.",
          risk: "write"
        },
        {
          name: "zendesk_add_internal_note",
          description: "Add an internal note to a Zendesk ticket.",
          risk: "write"
        }
      ]
    }
  }),
  event(6, {
    type: "tool.called",
    path: "action",
    source: "merge",
    payload: {
      toolName: "linear_create_issue",
      toolPackId: "tp_support_agent",
      registeredUserId: "ru_support_lead",
      arguments: {
        title: "Investigate SSO login failure for Acme",
        priority: "high",
        team: "identity"
      },
      correlationId: "ari_mock_correlation_001"
    }
  }),
  event(7, {
    type: "tool.completed",
    path: "action",
    source: "merge",
    payload: {
      toolName: "linear_create_issue",
      status: "success",
      latencyMs: 391,
      result: {
        issueId: "LIN-4821",
        url: "https://linear.example/LIN-4821"
      },
      correlationId: "ari_mock_correlation_001"
    }
  }),
  event(8, {
    type: "run.completed",
    path: "system",
    source: "mock",
    payload: {
      status: "success",
      summary: "The agent used permitted support context, drafted an issue, and created it through an allowed Linear tool."
    }
  })
];

type EventWithoutBase = Omit<TraceEvent, "id" | "runId" | "timestamp">;

function event(offsetSeconds: number, partial: EventWithoutBase): TraceEvent {
  return {
    id: `evt_${offsetSeconds.toString().padStart(3, "0")}`,
    runId,
    timestamp: new Date(timestampBase + offsetSeconds * 1000).toISOString(),
    ...partial
  } as TraceEvent;
}
