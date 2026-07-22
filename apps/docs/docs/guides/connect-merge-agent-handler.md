# Connect Merge Agent Handler

Merge Agent Handler is an optional upstream adapter for ARI.

The adapter needs a Merge Agent Handler MCP URL, a Registered User, a Tool Pack, and an API key. ARI uses those values to list tools, ask the configured action policy about a selected call, forward an allowed call, and record action events.

```bash
MERGE_AGENT_HANDLER_MCP_URL=
MERGE_REGISTERED_USER_ID=
MERGE_TOOL_PACK_ID=
MERGE_API_KEY=
ARI_COLLECTOR_URL=http://localhost:4319
```

## What ARI records

When an allowed action runs through this adapter, ARI can record:

- tools returned by the selected Tool Pack
- Registered User and Tool Pack identifiers
- authorization decision and policy identifier
- selected tool name
- tool arguments
- tool result or error
- latency and status
- correlation metadata for later audit work

The tool name and arguments must match the tools exposed by the selected Merge Tool Pack.
