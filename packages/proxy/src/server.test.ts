import type { TraceEvent } from "@ari/core";
import type { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createLocalContextProvider } from "./context-provider.js";
import type { createAriMcpProxyServer as createAriMcpProxyServerType } from "./server.js";

const mocks = vi.hoisted(() => {
  const recordedEvents: TraceEvent[] = [];
  const listTools = vi.fn();
  const callTool = vi.fn();

  return {
    recordedEvents,
    listTools,
    callTool
  };
});

vi.mock("@ari/ai-sdk", () => ({
  createHttpRecorder() {
    return {
      record(event: TraceEvent) {
        mocks.recordedEvents.push(event);
        return Promise.resolve();
      }
    };
  }
}));

vi.mock("@ari/merge", () => ({
  createMcpSdkTransport() {
    return {};
  },
  createMergeAgentHandlerClient() {
    return {
      listTools: mocks.listTools,
      callTool: mocks.callTool
    };
  }
}));

type RequestHandler = (request: { method: string; params?: Record<string, unknown> }, extra?: Record<string, unknown>) => Promise<unknown>;

type TestServer = {
  _requestHandlers: Map<string, RequestHandler>;
};

let createAriMcpProxyServer: typeof createAriMcpProxyServerType;

describe("ARI MCP proxy server", () => {
  beforeAll(async () => {
    ({ createAriMcpProxyServer } = await import("./server.js"));
  });

  beforeEach(() => {
    mocks.recordedEvents.length = 0;
    mocks.listTools.mockReset();
    mocks.callTool.mockReset();

    mocks.listTools.mockImplementation((runId: string, provenance?: ProvenanceFixture) => {
      const event: Extract<TraceEvent, { type: "tool.listed" }> = {
        id: "evt_tool_listed",
        runId,
        type: "tool.listed",
        path: "action",
        source: "merge",
        timestamp: "2026-06-15T00:00:00.000Z",
        payload: {
          ...provenance,
          toolPackId: "tp_123",
          registeredUserId: "ru_123",
          tools: [
            {
              name: "linear_create_issue",
              description: "Create a Linear issue."
            }
          ]
        }
      };

      return Promise.resolve({
        ok: true,
        data: {
          tools: event.payload.tools,
          event
        }
      });
    });

    mocks.callTool.mockImplementation(
      (input: {
        runId: string;
        toolName: string;
        arguments: Record<string, unknown>;
        provenance?: ProvenanceFixture;
      }) => {
        const started: Extract<TraceEvent, { type: "tool.called" }> = {
          id: "evt_tool_called",
          runId: input.runId,
          type: "tool.called",
          path: "action",
          source: "merge",
          timestamp: "2026-06-15T00:00:01.000Z",
          payload: {
            ...input.provenance,
            toolName: input.toolName,
            toolPackId: "tp_123",
            registeredUserId: "ru_123",
            arguments: input.arguments,
            correlationId: "corr_123"
          }
        };
        const completed: Extract<TraceEvent, { type: "tool.completed" }> = {
          id: "evt_tool_completed",
          runId: input.runId,
          type: "tool.completed",
          path: "action",
          source: "merge",
          timestamp: "2026-06-15T00:00:02.000Z",
          payload: {
            ...input.provenance,
            toolName: input.toolName,
            status: "success",
            latencyMs: 20,
            result: {
              issueId: "LIN-1"
            },
            correlationId: "corr_123"
          }
        };

        return Promise.resolve({
          ok: true,
          data: {
            started,
            completed,
            result: completed.payload.result,
            status: "success"
          }
        });
      }
    );
  });

  it("exposes the ARI context-scope tool alongside forwarded Merge tools", async () => {
    const server = await createTestServer();
    const result = await listTools(server);

    expect(result.tools.map((tool) => tool.name)).toEqual(["ari_get_context", "ari_record_context_scope", "linear_create_issue"]);
  }, 15_000);

  it("returns an explicit error when ARI context is requested without a configured context provider", async () => {
    const server = await createTestServer();
    const result = await callTool(server, "ari_get_context", {
      task: "Create a follow-up issue",
      requesterId: "samuel",
      purpose: "support_to_linear_issue"
    });

    expect(result.isError).toBe(true);
    expect(textFromToolResult(result)).toContain("no context provider is configured");
  });

  it("blocks forwarded tool calls until context scope is recorded", async () => {
    const server = await createTestServer();
    const result = await callTool(server, "linear_create_issue", {
      title: "Create follow-up issue"
    });

    expect(result.isError).toBe(true);
    expect(mocks.callTool).not.toHaveBeenCalled();
    expect(mocks.recordedEvents.map((event) => event.type)).toEqual(["run.started", "tool.blocked", "run.completed"]);

    const blocked = mocks.recordedEvents.find((event): event is Extract<TraceEvent, { type: "tool.blocked" }> => event.type === "tool.blocked");
    expect(blocked?.payload.toolName).toBe("linear_create_issue");
    expect(blocked?.payload.policy).toBe("context_scope_required");
  });

  it("records context scope and binds later Merge tool events to the same provenance ids", async () => {
    const server = await createTestServer();

    const scopeResult = await callTool(server, "ari_record_context_scope", {
      title: "Escalate support request",
      permissionSnapshotId: "perm_123",
      contextDecisionId: "ctx_123",
      authorizationDecisionId: "auth_123",
      authorizationRule: "support_ticket_allows_issue_creation",
      selected: [
        {
          sourceId: "ticket_123",
          sourceType: "zendesk_ticket",
          title: "Customer escalation",
          reason: "The issue title and customer impact are needed for the Linear issue.",
          permissionRule: "user_can_read_ticket"
        }
      ],
      excluded: [
        {
          sourceId: "slack_private_note",
          sourceType: "slack_message",
          title: "Private internal note",
          reason: "Private channel content is outside this user's authorization boundary.",
          permissionRule: "private_channel_excluded"
        }
      ]
    });

    expect(scopeResult.isError).toBe(false);

    const toolResult = await callTool(server, "linear_create_issue", {
      title: "Escalate customer issue"
    });

    expect(toolResult.isError).toBe(false);
    expect(mocks.listTools).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        permissionSnapshotId: "perm_123",
        contextDecisionId: "ctx_123",
        authorizationDecisionId: "auth_123",
        authorizationRule: "support_ticket_allows_issue_creation"
      })
    );
    const manualProvenanceMatcher: unknown = expect.objectContaining({
      contextDecisionId: "ctx_123"
    });
    expect(mocks.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "linear_create_issue",
        provenance: manualProvenanceMatcher
      })
    );

    const linkedEvents = mocks.recordedEvents.filter(
      (event) =>
        event.type === "context.selected" ||
        event.type === "context.excluded" ||
        event.type === "tool.listed" ||
        event.type === "tool.called" ||
        event.type === "tool.completed"
    );

    expect(linkedEvents.map((event) => event.payload.contextDecisionId)).toEqual([
      "ctx_123",
      "ctx_123",
      "ctx_123",
      "ctx_123",
      "ctx_123"
    ]);
    expect(linkedEvents.map((event) => event.payload.authorizationRule)).toEqual([
      "support_ticket_allows_issue_creation",
      "support_ticket_allows_issue_creation",
      "support_ticket_allows_issue_creation",
      "support_ticket_allows_issue_creation",
      "support_ticket_allows_issue_creation"
    ]);
  });

  it("gets context from ARI, withholds excluded content, and binds later tool events to the generated context decision", async () => {
    const server = await createTestServer({
      contextProvider: createLocalContextProvider({
        requesters: [
          {
            requesterId: "samuel",
            scopes: ["support_team_member", "linear_issue_writer"]
          }
        ],
        sources: [
          {
            sourceId: "support_ticket_438",
            sourceType: "support_ticket",
            title: "Checkout failure after SSO login",
            content: "Customer cannot complete checkout after SSO login.",
            requiredScopes: ["support_team_member"],
            allowedPurposes: ["support_to_linear_issue"]
          },
          {
            sourceId: "private_finance_note_991",
            sourceType: "slack_message",
            title: "Private finance escalation note",
            content: "Finance-only risk memo that must not be returned to the agent.",
            requiredScopes: ["finance_channel_member"],
            allowedPurposes: ["support_to_linear_issue"]
          }
        ]
      })
    });

    const contextResult = await callTool(server, "ari_get_context", {
      task: "Create a Linear issue from this support escalation.",
      requesterId: "samuel",
      purpose: "support_to_linear_issue"
    });

    expect(contextResult.isError).toBe(false);
    const contextPayload = contextResponseSchema.parse(JSON.parse(textFromToolResult(contextResult)) as unknown);
    expect(contextPayload.selected).toEqual([
      expect.objectContaining({
        sourceId: "support_ticket_438",
        content: "Customer cannot complete checkout after SSO login."
      })
    ]);
    expect(contextPayload.excludedSummary).toHaveLength(1);
    expect(contextPayload.excludedSummary[0]?.sourceId).toBe("private_finance_note_991");
    expect(contextPayload.excludedSummary[0]).not.toHaveProperty("content");

    const toolResult = await callTool(server, "linear_create_issue", {
      title: "Escalate checkout failure"
    });

    expect(toolResult.isError).toBe(false);
    const providerProvenanceMatcher: unknown = expect.objectContaining({
      contextDecisionId: contextPayload.contextDecisionId
    });
    expect(mocks.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        provenance: providerProvenanceMatcher
      })
    );

    const linkedEvents = mocks.recordedEvents.filter(
      (event) =>
        event.type === "context.selected" ||
        event.type === "context.excluded" ||
        event.type === "tool.listed" ||
        event.type === "tool.called" ||
        event.type === "tool.completed"
    );
    expect(linkedEvents.every((event) => event.payload.contextDecisionId === contextPayload.contextDecisionId)).toBe(true);
  });
});

type ProvenanceFixture = {
  permissionSnapshotId: string;
  contextDecisionId: string;
  authorizationDecisionId: string;
  authorizationRule?: string;
};

const contextResponseSchema = z.object({
  contextDecisionId: z.string().min(1),
  selected: z.array(
    z.object({
      sourceId: z.string().min(1),
      content: z.string().min(1)
    })
  ),
  excludedSummary: z.array(
    z.object({
      sourceId: z.string().min(1),
      content: z.string().optional()
    })
  )
});

async function createTestServer(
  options: Partial<Parameters<typeof createAriMcpProxyServer>[0]> = {}
): Promise<TestServer> {
  const server = await createAriMcpProxyServer({
    collectorUrl: "http://collector.test",
    merge: {
      mcpUrl: "https://merge.test/mcp",
      registeredUserId: "ru_123",
      toolPackId: "tp_123"
    },
    ...options
  });

  return server as unknown as TestServer;
}

function textFromToolResult(result: CallToolResult): string {
  const first = result.content[0];

  if (!first || first.type !== "text") {
    throw new Error("Expected text tool result.");
  }

  return first.text;
}

async function listTools(server: TestServer): Promise<ListToolsResult> {
  const handler = getHandler(server, "tools/list");
  return (await handler({ method: "tools/list" })) as ListToolsResult;
}

async function callTool(
  server: TestServer,
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const handler = getHandler(server, "tools/call");
  return (await handler({
    method: "tools/call",
    params: {
      name,
      arguments: args
    }
  })) as CallToolResult;
}

function getHandler(server: TestServer, method: string): RequestHandler {
  const handler = server._requestHandlers.get(method);

  if (!handler) {
    throw new Error(`No handler registered for ${method}`);
  }

  return handler;
}
