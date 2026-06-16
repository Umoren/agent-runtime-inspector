# Use MCP proxy mode

Proxy mode lets an MCP-capable agent connect to ARI first. ARI then forwards tool calls to Merge Agent Handler and records the action path.

```text
MCP agent -> ARI MCP proxy -> Merge Agent Handler -> external app
                    |
                    -> collector -> dashboard
```

This makes the agent's tool execution path inspectable without changing the external system the tool eventually reaches.

## Expected event shape

A simple proxy run records:

```text
run.started
tool.listed
tool.called
tool.completed
run.completed
```

Future context-provenance work will bind those action events to context and authorization decision identifiers.
