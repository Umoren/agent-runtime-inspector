import { describe, expect, it } from "vitest";
import { createMergeAgentHandlerClient } from "./client.js";
import type { AgentHandlerTransport } from "./transport.js";

describe("Merge Agent Handler client", () => {
  it("builds a tool listed event from transport tools", async () => {
    const transport: AgentHandlerTransport = {
      listTools() {
        return Promise.resolve([
          {
            name: "linear_create_issue",
            description: "Create a Linear issue.",
            inputSchema: {
              type: "object",
              properties: {
                title: { type: "string" }
              }
            }
          }
        ]);
      },
      callTool() {
        return Promise.resolve({});
      }
    };
    const client = createMergeAgentHandlerClient(
      {
        mcpUrl: "https://example.com/mcp",
        registeredUserId: "ru_123",
        toolPackId: "tp_123"
      },
      transport
    );

    const result = await client.listTools("run_123");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.event.type).toBe("tool.listed");
      if (result.data.event.type === "tool.listed") {
        expect(result.data.event.payload.tools).toEqual([{ name: "linear_create_issue" }]);
        expect(result.data.event.payload.toolCount).toBe(1);
        expect(result.data.event.payload.inventoryHash).toMatch(/^sha256:[a-f0-9]{64}$/);
        expect(result.data.event.payload.tools[0]).not.toHaveProperty("description");
        expect(result.data.event.payload.tools[0]).not.toHaveProperty("inputSchema");
        expect(result.data.tools[0]?.description).toBe("Create a Linear issue.");
        expect(result.data.tools[0]?.inputSchema).toEqual({
          type: "object",
          properties: {
            title: { type: "string" }
          }
        });
      }
    }
  });

  it("builds the same inventory hash regardless of tool order or schema key order", async () => {
    const first = createMergeAgentHandlerClient(
      {
        mcpUrl: "https://example.com/mcp",
        registeredUserId: "ru_123",
        toolPackId: "tp_123"
      },
      transportWithTools([
        { name: "beta", inputSchema: { required: ["id"], type: "object" } },
        { name: "alpha", inputSchema: { type: "object", properties: { id: { type: "string" } } } }
      ])
    );
    const second = createMergeAgentHandlerClient(
      {
        mcpUrl: "https://example.com/mcp",
        registeredUserId: "ru_123",
        toolPackId: "tp_123"
      },
      transportWithTools([
        { name: "alpha", inputSchema: { properties: { id: { type: "string" } }, type: "object" } },
        { name: "beta", inputSchema: { type: "object", required: ["id"] } }
      ])
    );

    const firstResult = await first.listTools("run_first");
    const secondResult = await second.listTools("run_second");

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    if (firstResult.ok && secondResult.ok && firstResult.data.event.type === "tool.listed" && secondResult.data.event.type === "tool.listed") {
      expect(firstResult.data.event.payload.inventoryHash).toBe(secondResult.data.event.payload.inventoryHash);
      expect(firstResult.data.event.payload.tools.map((tool) => tool.name)).toEqual(["alpha", "beta"]);
    }
  });

  it("builds tool called and completed events", async () => {
    const transport: AgentHandlerTransport = {
      listTools() {
        return Promise.resolve([]);
      },
      callTool() {
        return Promise.resolve({ issueId: "LIN-1" });
      }
    };
    const client = createMergeAgentHandlerClient(
      {
        mcpUrl: "https://example.com/mcp",
        registeredUserId: "ru_123",
        toolPackId: "tp_123"
      },
      transport
    );

    const result = await client.callTool({
      runId: "run_123",
      toolName: "linear_create_issue",
      arguments: {
        title: "Test"
      },
      correlationId: "corr_123"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.started.type).toBe("tool.called");
      expect(result.data.completed.type).toBe("tool.completed");
      if (result.data.completed.type === "tool.completed") {
        expect(result.data.completed.payload.status).toBe("success");
      }
    }
  });

  it("binds listed, called, and completed tool events to provenance decisions", async () => {
    const transport: AgentHandlerTransport = {
      listTools() {
        return Promise.resolve([
          {
            name: "github__create_issue"
          }
        ]);
      },
      callTool() {
        return Promise.resolve({ issueId: "ISSUE-1" });
      }
    };
    const client = createMergeAgentHandlerClient(
      {
        mcpUrl: "https://example.com/mcp",
        registeredUserId: "ru_123",
        toolPackId: "tp_123"
      },
      transport
    );
    const provenance = {
      permissionSnapshotId: "perm_123",
      contextDecisionId: "ctx_123",
      authorizationDecisionId: "auth_123",
      authorizationRule: "project_context_allows_issue_creation"
    };

    const listed = await client.listTools("run_123", provenance);
    const called = await client.callTool({
      runId: "run_123",
      toolName: "github__create_issue",
      arguments: {
        title: "Test"
      },
      correlationId: "corr_123",
      provenance
    });

    expect(listed.ok).toBe(true);
    expect(called.ok).toBe(true);

    if (listed.ok && listed.data.event.type === "tool.listed") {
      expect(listed.data.event.payload.contextDecisionId).toBe("ctx_123");
      expect(listed.data.event.payload.permissionSnapshotId).toBe("perm_123");
      expect(listed.data.event.payload.authorizationDecisionId).toBe("auth_123");
    }

    if (called.ok && called.data.started.type === "tool.called" && called.data.completed.type === "tool.completed") {
      expect(called.data.started.payload.contextDecisionId).toBe("ctx_123");
      expect(called.data.started.payload.authorizationRule).toBe("project_context_allows_issue_creation");
      expect(called.data.completed.payload.contextDecisionId).toBe("ctx_123");
      expect(called.data.completed.payload.authorizationDecisionId).toBe("auth_123");
    }
  });

  it("marks MCP tool results with isError as failed tool executions", async () => {
    const transport: AgentHandlerTransport = {
      listTools() {
        return Promise.resolve([]);
      },
      callTool() {
        return Promise.resolve({
          isError: true,
          content: [
            {
              type: "text",
              text: "GitHub rejected the create issue request."
            }
          ]
        });
      }
    };
    const client = createMergeAgentHandlerClient(
      {
        mcpUrl: "https://example.com/mcp",
        registeredUserId: "ru_123",
        toolPackId: "tp_123"
      },
      transport
    );

    const result = await client.callTool({
      runId: "run_123",
      toolName: "github__create_issue",
      arguments: {
        title: "Test"
      },
      correlationId: "corr_123"
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data.completed.type === "tool.completed") {
      expect(result.data.completed.payload.status).toBe("error");
      expect(result.data.completed.payload.errorMessage).toBe("GitHub rejected the create issue request.");
    }
  });
});

function transportWithTools(tools: Awaited<ReturnType<AgentHandlerTransport["listTools"]>>): AgentHandlerTransport {
  return {
    listTools() {
      return Promise.resolve(tools);
    },
    callTool() {
      return Promise.resolve({});
    }
  };
}
