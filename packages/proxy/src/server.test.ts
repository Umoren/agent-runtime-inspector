import type { TraceEvent } from "@ari/core";
import type { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
      async record(event: TraceEvent) {
        mocks.recordedEvents.push(event);
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

let createAriMcpProxyServer: typeof import("./server.js").createAriMcpProxyServer;

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

    expect(result.tools.map((tool) => tool.name)).toEqual(["ari_record_context_scope", "linear_create_issue"]);
  }, 15_000);

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
    expect(mocks.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "linear_create_issue",
        provenance: expect.objectContaining({
          contextDecisionId: "ctx_123"
        })
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
});

type ProvenanceFixture = {
  permissionSnapshotId: string;
  contextDecisionId: string;
  authorizationDecisionId: string;
  authorizationRule?: string;
};

async function createTestServer(): Promise<TestServer> {
  const server = await createAriMcpProxyServer({
    collectorUrl: "http://collector.test",
    merge: {
      mcpUrl: "https://merge.test/mcp",
      registeredUserId: "ru_123",
      toolPackId: "tp_123"
    }
  });

  return server as unknown as TestServer;
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
