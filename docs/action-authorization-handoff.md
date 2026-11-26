# ARI action authorization: technical handoff

## What we built

ARI now sits between an agent and an upstream Model Context Protocol (MCP) server. The agent can ask ARI for permitted context and can see the upstream tools, but ARI checks policy before it forwards an exact tool call.

The gateway records:

> ARI records who tried to perform which action, for what purpose, using which approved context, under which policy decision.

The implementation is provider-neutral. GitHub MCP or another MCP server is configured outside the core. Service-specific rules also live outside the core in the policy engine.

## The five parts

1. **Context provider** finds candidate files and selects only the sources the principal may use.
2. **Trusted identity** binds the gateway process to one principal and one purpose. The agent cannot invent either value.
3. **Action provider** gives ARI one interface for listing and calling tools on any upstream MCP server.
4. **Policy engine** receives the exact attempted action and returns allow or deny.
5. **Trace recorder** writes context, authorization, tool, and run events for later audit.

## The request flow

An agent first calls `ari_get_context` with a task. ARI gets the principal and purpose from operator configuration, not from agent arguments:

```ts
const request: ContextRequest = {
  task: parsed.data.task,
  requesterId: options.identity.principalId,
  purpose: options.identity.purpose
};
```

Source: `packages/proxy/src/server.ts`.

The context provider returns candidates. ARI records every selected and excluded source and keeps two IDs: `permissionSnapshotId` identifies the permission state, while `contextDecisionId` identifies this specific context selection.

When the agent attempts an upstream tool call, ARI constructs a provider-neutral policy input:

```ts
const authorization = await policyEngine.evaluate({
  principal: { id: principalId, scopes: principalScopes },
  purpose,
  upstream: { id: upstreamId, type: upstreamType },
  action: { name: toolName, arguments: toolArguments },
  context: { permissionSnapshotId, contextDecisionId, selected }
});
```

The policy sees the exact tool name and arguments. It can allow `create_draft` while denying `send_message`, or constrain a draft by recipient and selected context. ARI does not hardcode Gmail or another provider's fields.

## How policy works

ARI sends the input to an Open Policy Agent (OPA) data endpoint. It expects this small result:

```json
{
  "result": {
    "allow": true,
    "reason": "Requester may create a reviewable outreach draft.",
    "policyId": "career.outreach.create_draft",
    "policyVersion": "1"
  }
}
```

`allow` controls execution. `reason`, `policyId`, and `policyVersion` explain the decision to an auditor. ARI records the result as `authorization.decided` and gives it an `authorizationDecisionId`.

OPA errors fail closed:

```ts
if (!response.ok) {
  return deny("opa.http_error", `Policy service returned HTTP ${response.status}.`);
}
```

Missing policy configuration, an unreachable endpoint, invalid JSON, and an undefined decision all produce a denial. This behavior is implemented in `packages/proxy/src/policy.ts`.

## The hard safety boundary

On denial, ARI records both the decision and a `tool.blocked` event, completes the run as an error, and returns before the action provider is called.

```ts
if (authorization.decision === "deny") {
  await safeRecord(blockedEvent);
  await recordRunCompleted(runId, "error", authorization.reason);
  return textToolResult(authorization.reason, true);
}
```

The server test checks that the fake upstream's call count remains zero after a denied attempt. The side effect never reaches the external service.

## Why the action provider exists

ARI's server depends on this provider-neutral interface:

```ts
type ActionTransport = {
  listTools(): Promise<ActionTool[]>;
  callTool(input: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown>;
};
```

`createHttpMcpActionProvider` implements that interface for any Streamable HTTP MCP server. Adding a provider should normally mean adding configuration, not changing authorization logic.

## OAuth-protected MCP servers

For providers such as Google's Gmail MCP server, ARI supplies an MCP OAuth client provider. It prints the provider's authorization URL, receives the redirect on a loopback callback, exchanges the authorization code, and stores the resulting tokens locally.

```ts
const transport = new StreamableHTTPClientTransport(new URL(config.url), {
  authProvider: oauthProvider
});
```

Tokens are parsed against the MCP SDK schema, persisted with file mode `0600`, and removed when invalidated. Use an ignored path such as `.ari/gmail-tokens.json`. The implementation is in `packages/proxy/src/oauth-provider.ts` and is covered by persistence, malformed-file, and invalidation tests.

## Configuration boundaries

- No Gmail tool names or argument rules in ARI core.
- No allowlist of recipients in TypeScript.
- No assumption about the upstream provider.
- No identity or purpose accepted from an untrusted agent assertion.
- No implicit allow when OPA is missing or unhealthy.

The operator chooses the upstream, identity, purpose, context registry, and policy endpoint through configuration. Business rules belong in versioned OPA policy and data.

## What is proven now

The authorization path proves:

- Selected and excluded context are linked to a permission snapshot and context decision.
- Each attempted action produces an explicit authorization decision.
- Allowed actions carry the authorization ID into tool events.
- Denied actions produce `tool.blocked` and do not call the upstream transport.

The integration path also proves:

- Streamable HTTP MCP actions use the same authorization path.
- OAuth tokens survive process restarts without being placed in trace events.

## What remains before the Gmail workflow is real

1. Create a Google Cloud OAuth client, enable the required APIs, and configure the Gmail scopes.
2. Configure a loopback redirect URL.
3. Run an OPA endpoint with a versioned policy for the outreach-draft workflow.
4. Point ARI at real local career/outreach context files.
5. Authorize Gmail, create one real draft through `create_draft`, and verify the linked decision IDs in the dashboard.

Until those credentials and that real draft exist, the generic authorization gateway is tested, but the Gmail integration is not yet proven end to end.
