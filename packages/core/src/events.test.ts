import { describe, expect, it } from "vitest";
import { traceEventSchema } from "./events.js";

describe("trace event schema", () => {
  it("strips legacy tool descriptions and input schemas from tool inventory evidence", () => {
    const parsed = traceEventSchema.parse({
      id: "evt_legacy_inventory",
      runId: "run_legacy_inventory",
      timestamp: "2026-07-17T00:00:00.000Z",
      type: "tool.listed",
      path: "action",
      source: "merge",
      payload: {
        toolPackId: "tp_legacy",
        registeredUserId: "ru_legacy",
        tools: [
          {
            name: "github__get_authenticated_user",
            description: "Return the authenticated GitHub user.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          }
        ]
      }
    });

    expect(parsed.type).toBe("tool.listed");
    if (parsed.type === "tool.listed") {
      expect(parsed.payload.tools).toEqual([{ name: "github__get_authenticated_user" }]);
      expect(parsed.payload.toolCount).toBeUndefined();
      expect(parsed.payload.inventoryHash).toBeUndefined();
    }
  });

  it("parses explicit action authorization evidence", () => {
    const parsed = traceEventSchema.parse({
      id: "evt_auth",
      runId: "run_123",
      type: "authorization.decided",
      path: "action",
      source: "policy",
      timestamp: "2026-07-17T00:00:00.000Z",
      payload: {
        permissionSnapshotId: "perm_123",
        contextDecisionId: "ctx_123",
        authorizationDecisionId: "auth_123",
        authorizationRule: "email.draft.recipient_in_thread",
        principalId: "samuel",
        purpose: "respond_to_email",
        upstreamId: "customer-email",
        toolName: "email_create_draft",
        decision: "allow",
        reason: "The recipient appears in the selected thread.",
        policyId: "email.draft.recipient_in_thread",
        policyVersion: "7"
      }
    });

    expect(parsed.type).toBe("authorization.decided");
  });
});
