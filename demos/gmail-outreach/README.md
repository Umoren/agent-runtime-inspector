# Gmail outreach policy

This demo runs Open Policy Agent (OPA) locally as ARI's action-policy service. `policy.rego` contains the enforcement logic. The ignored `policy-data.json` contains the approved recipient and the workflow switch.

The policy permits one Gmail `create_draft` call only when all of the following are true:

- the configured principal, purpose, and upstream match;
- the draft has exactly the approved primary recipient list;
- the request has no CC, BCC, HTML body, or reply target;
- the plain-text body does not exceed the configured length;
- ARI selected all required outreach context source types.

The policy never permits sending email. Gmail's MCP `create_draft` creates a reviewable draft only.

1. Copy `opa/policy-data.example.json` to `opa/policy-data.json`.

2. Replace the example recipient.

3. Change `enabled` to `true` only when the first draft is approved for creation.

4. Start OPA from this directory:

```bash
docker compose up
```

5. Set the policy endpoint in ARI's root `.env`:

```dotenv
ARI_POLICY_DECISION_URL=http://127.0.0.1:8181/v1/data/ari/gateway/result
```

This demo defines the policy boundary. It does not prove the Gmail integration until ARI creates a real draft and the dashboard links the context, authorization, and tool events.
