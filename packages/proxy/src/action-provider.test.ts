import { describe, expect, it, vi } from "vitest";
import { createInstrumentedActionProvider } from "./action-provider.js";

describe("instrumented action provider", () => {
  it("keeps complete runtime definitions and records compact provider-neutral inventory", async () => {
    const provider = createInstrumentedActionProvider(
      { upstreamId: "customer-email", upstreamType: "mcp", eventSource: "mcp" },
      {
        listTools() {
          return Promise.resolve([{
            name: "email_create_draft",
            description: "Create a draft email.",
            inputSchema: { type: "object", properties: { recipient: { type: "string" } } }
          }]);
        },
        callTool() {
          return Promise.resolve({ draftId: "draft_123" });
        }
      }
    );

    const result = await provider.listTools("run_123");

    expect(result.ok).toBe(true);
    if (result.ok && result.data.event.type === "tool.listed") {
      expect(result.data.tools[0]?.description).toBe("Create a draft email.");
      expect(result.data.event.source).toBe("mcp");
      expect(result.data.event.payload).toEqual(expect.objectContaining({
        upstreamId: "customer-email",
        upstreamType: "mcp",
        toolCount: 1,
        tools: [{ name: "email_create_draft" }]
      }));
      expect(result.data.event.payload.inventoryHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(result.data.event.payload.tools[0]).not.toHaveProperty("description");
      expect(result.data.event.payload.tools[0]).not.toHaveProperty("inputSchema");
    }
  });

  it("records an authorized call around the unchanged upstream request", async () => {
    const callTool = vi.fn(() => Promise.resolve({ draftId: "draft_123" }));
    const provider = createInstrumentedActionProvider(
      { upstreamId: "customer-email", upstreamType: "mcp", eventSource: "mcp" },
      {
        listTools() {
          return Promise.resolve([]);
        },
        callTool
      }
    );

    const result = await provider.callTool({
      runId: "run_123",
      toolName: "email_create_draft",
      arguments: { recipient: "customer@example.com" },
      provenance: {
        permissionSnapshotId: "perm_123",
        contextDecisionId: "ctx_123",
        authorizationDecisionId: "auth_123",
        authorizationRule: "email.draft.allowed"
      }
    });

    expect(callTool).toHaveBeenCalledWith({
      name: "email_create_draft",
      arguments: { recipient: "customer@example.com" }
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.data.started.type === "tool.called" && result.data.completed.type === "tool.completed") {
      expect(result.data.started.payload.authorizationDecisionId).toBe("auth_123");
      expect(result.data.started.payload.upstreamId).toBe("customer-email");
      expect(result.data.completed.payload.status).toBe("success");
      expect(result.data.completed.payload.result).toEqual({ draftId: "draft_123" });
    }
  });
});
