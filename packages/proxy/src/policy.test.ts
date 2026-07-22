import { describe, expect, it, vi } from "vitest";
import { createDenyAllPolicyEngine, createOpaHttpPolicyEngine, type ActionAuthorizationInput } from "./policy.js";

const input: ActionAuthorizationInput = {
  principal: { id: "samuel", scopes: ["email_reader"] },
  purpose: "respond_to_email",
  upstream: { id: "customer-email", type: "mcp" },
  action: { name: "email_create_draft", arguments: { recipient: "customer@example.com" } },
  context: {
    permissionSnapshotId: "perm_123",
    contextDecisionId: "ctx_123",
    selected: [{ sourceId: "thread_123", sourceType: "email_thread" }]
  }
};

describe("action policy engines", () => {
  it("denies every action when no policy service is configured", async () => {
    const decision = await createDenyAllPolicyEngine().evaluate(input);

    expect(decision).toEqual({
      decision: "deny",
      reason: "No action policy engine is configured.",
      policyId: "ari.default_deny"
    });
  });

  it("sends a generic authorization document to OPA and returns its evidence", async () => {
    const request = vi.fn(() => Promise.resolve(Response.json({
      result: {
        allow: true,
        reason: "Draft creation is allowed for a recipient in the selected thread.",
        policyId: "email.draft.recipient_in_thread",
        policyVersion: "7"
      }
    })));
    const engine = createOpaHttpPolicyEngine({
      decisionUrl: "http://policy.test/v1/data/ari/action/decision",
      fetch: request
    });

    const decision = await engine.evaluate(input);

    expect(request).toHaveBeenCalledWith(
      "http://policy.test/v1/data/ari/action/decision",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ input }) })
    );
    expect(decision).toEqual({
      decision: "allow",
      reason: "Draft creation is allowed for a recipient in the selected thread.",
      policyId: "email.draft.recipient_in_thread",
      policyVersion: "7"
    });
  });

  it("fails closed when OPA is unavailable or returns no decision", async () => {
    const unavailable = createOpaHttpPolicyEngine({
      decisionUrl: "http://policy.test/v1/data/ari/action/decision",
      fetch: () => Promise.reject(new Error("connection refused"))
    });
    const undefinedDecision = createOpaHttpPolicyEngine({
      decisionUrl: "http://policy.test/v1/data/ari/action/decision",
      fetch: () => Promise.resolve(Response.json({}))
    });

    await expect(unavailable.evaluate(input)).resolves.toEqual({
      decision: "deny",
      reason: "Policy service could not be reached: connection refused",
      policyId: "opa.unavailable"
    });
    await expect(undefinedDecision.evaluate(input)).resolves.toEqual({
      decision: "deny",
      reason: "Policy service returned no valid action decision.",
      policyId: "opa.undefined"
    });
  });
});
