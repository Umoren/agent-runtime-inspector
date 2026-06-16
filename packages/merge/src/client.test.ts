import { describe, expect, it } from "vitest";
import { createMergeAgentHandlerClient } from "./client.js";
import type { AgentHandlerTransport } from "./transport.js";

describe("Merge Agent Handler client", () => {
  it("builds a tool listed event from transport tools", async () => {
    const transport: AgentHandlerTransport = {
      async listTools() {
        return [
          {
            name: "linear_create_issue",
            description: "Create a Linear issue."
          }
        ];
      },
      async callTool() {
        return {};
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
        expect(result.data.event.payload.tools[0]?.name).toBe("linear_create_issue");
      }
    }
  });

  it("builds tool called and completed events", async () => {
    const transport: AgentHandlerTransport = {
      async listTools() {
        return [];
      },
      async callTool() {
        return { issueId: "LIN-1" };
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
      async listTools() {
        return [
          {
            name: "github__create_issue"
          }
        ];
      },
      async callTool() {
        return { issueId: "ISSUE-1" };
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
      async listTools() {
        return [];
      },
      async callTool() {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "GitHub rejected the create issue request."
            }
          ]
        };
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
