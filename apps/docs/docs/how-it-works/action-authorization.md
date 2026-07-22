# Action authorization

ARI checks every attempted upstream tool call before forwarding it. The check is separate from context selection because permission to read context does not automatically grant permission to perform an action.

## Trusted input

The gateway operator configures `ARI_PRINCIPAL_ID` and `ARI_PURPOSE`. Values asserted by the agent are rejected when they do not match this trusted configuration.

For each attempted action, ARI sends the policy engine one provider-neutral JSON document:

```json
{
  "input": {
    "principal": { "id": "user-id", "scopes": ["scope-a"] },
    "purpose": "configured-purpose",
    "upstream": { "id": "operator-defined-id", "type": "mcp" },
    "action": { "name": "tool_name", "arguments": {} },
    "context": {
      "permissionSnapshotId": "perm_...",
      "contextDecisionId": "ctx_...",
      "selected": [{ "sourceId": "source-id", "sourceType": "source-type" }]
    }
  }
}
```

ARI does not interpret service-specific tool names or argument fields. Open Policy Agent (OPA) policies constrain those values for each workflow.

## Decision contract

The configured OPA data endpoint must return an object under `result`:

```json
{
  "result": {
    "allow": true,
    "reason": "Human-readable decision reason.",
    "policyId": "stable.policy.identifier",
    "policyVersion": "optional-version"
  }
}
```

ARI records this as `authorization.decided`. The `authorizationDecisionId` also appears on the later `tool.listed`, `tool.called`, and `tool.completed` events.

## Fail-closed behavior

ARI denies the action when the policy endpoint is missing, unreachable, returns an HTTP error, or returns no valid decision. A denial records `authorization.decided` and `tool.blocked`. The gateway returns before invoking the upstream `callTool` method.
