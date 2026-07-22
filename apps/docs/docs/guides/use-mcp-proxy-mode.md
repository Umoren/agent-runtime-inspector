# Use MCP gateway mode

Gateway mode lets an MCP-capable agent connect to ARI first. ARI retrieves permitted context, asks the configured policy engine about each attempted action, and forwards allowed calls to any configured Streamable HTTP MCP server.

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

A denied run records `authorization.decided`, `tool.blocked`, and `run.completed`. ARI does not call the upstream tool after a deny decision.
