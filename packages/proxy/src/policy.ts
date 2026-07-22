import { z } from "zod";

export type ActionAuthorizationInput = {
  principal: {
    id: string;
    scopes: readonly string[];
  };
  purpose: string;
  upstream: {
    id: string;
    type: string;
  };
  action: {
    name: string;
    arguments: Record<string, unknown>;
  };
  context: {
    permissionSnapshotId: string;
    contextDecisionId: string;
    selected: readonly {
      sourceId: string;
      sourceType: string;
    }[];
  };
};

export type ActionAuthorizationDecision = {
  decision: "allow" | "deny";
  reason: string;
  policyId: string;
  policyVersion?: string;
};

export type PolicyEngine = {
  evaluate(input: ActionAuthorizationInput): Promise<ActionAuthorizationDecision>;
};

export type OpaHttpPolicyEngineConfig = {
  decisionUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

const opaResponseSchema = z.object({
  result: z
    .object({
      allow: z.boolean(),
      reason: z.string().min(1),
      policyId: z.string().min(1),
      policyVersion: z.string().min(1).optional()
    })
    .optional()
});

export function createOpaHttpPolicyEngine(config: OpaHttpPolicyEngineConfig): PolicyEngine {
  const request = config.fetch ?? fetch;

  return {
    async evaluate(input) {
      try {
        const response = await request(config.decisionUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...config.headers
          },
          body: JSON.stringify({ input })
        });

        if (!response.ok) {
          return deny("opa.http_error", `Policy service returned HTTP ${String(response.status)}.`);
        }

        const parsed = opaResponseSchema.safeParse(await response.json() as unknown);
        if (!parsed.success || !parsed.data.result) {
          return deny("opa.undefined", "Policy service returned no valid action decision.");
        }

        return {
          decision: parsed.data.result.allow ? "allow" : "deny",
          reason: parsed.data.result.reason,
          policyId: parsed.data.result.policyId,
          ...(parsed.data.result.policyVersion ? { policyVersion: parsed.data.result.policyVersion } : {})
        };
      } catch (error) {
        return deny("opa.unavailable", `Policy service could not be reached: ${errorMessage(error)}`);
      }
    }
  };
}

export function createDenyAllPolicyEngine(reason = "No action policy engine is configured."): PolicyEngine {
  return {
    evaluate() {
      return Promise.resolve(deny("ari.default_deny", reason));
    }
  };
}

function deny(policyId: string, reason: string): ActionAuthorizationDecision {
  return { decision: "deny", reason, policyId };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
