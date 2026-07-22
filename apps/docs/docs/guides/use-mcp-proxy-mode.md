# Use MCP gateway mode

1. Configure the trusted identity, context provider, upstream MCP server, and policy endpoint in `.env`.

2. Start the collector and dashboard with `pnpm dev`.

3. Start the gateway in another terminal with `pnpm proxy`.

4. Point the MCP client at ARI's stdio command instead of the upstream server.

5. Call `ari_get_context` before an upstream tool.

ARI retrieves permitted context, asks the policy engine about the exact attempted action, and forwards allowed calls to the configured Streamable HTTP MCP server.

```text
MCP agent -> ARI gateway -> upstream MCP server -> external app
                 |  |
                 |  -> policy engine
                 -> collector -> dashboard
```

## Expected event shape

An allowed run records:

```text
run.started
context.selected
context.excluded
authorization.decided
tool.listed
tool.called
tool.completed
run.completed
```

A denied run records `authorization.decided`, `tool.blocked`, and `run.completed`. ARI returns before calling the upstream tool.
