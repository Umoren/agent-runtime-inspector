# Gmail outreach policy

This demo runs OPA locally as ARI's action-policy service. `policy.rego` is generic enforcement logic. `policy-data.json` is ignored local workflow data containing the approved recipient and the enabled switch.

The policy permits one Gmail `create_draft` call only when all of the following are true:

- the configured principal, purpose, and upstream match;
- the draft has exactly the approved primary recipient list;
- the request has no CC, BCC, HTML body, or reply target;
- the plain-text body does not exceed the configured length;
- ARI selected all required outreach context source types.

The policy never permits sending email. Gmail's MCP `create_draft` creates a reviewable draft only.

Before starting OPA, copy `opa/policy-data.example.json` to ignored `opa/policy-data.json`, replace the recipient, and change `enabled` to `true` only when the first draft is approved for creation.

Run OPA from this directory:

```bash
docker compose up
```

Set this in ARI's root `.env`:

```dotenv
ARI_POLICY_DECISION_URL=http://127.0.0.1:8181/v1/data/ari/gateway/result
```
