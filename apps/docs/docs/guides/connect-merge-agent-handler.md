# Connect Merge Agent Handler

Merge Agent Handler is the first connected action path for ARI.

The connected path needs a Merge Agent Handler MCP URL, a Registered User, a Tool Pack, and an API key. ARI uses those values to list tools, forward selected calls, and record action events.

```bash
MERGE_AGENT_HANDLER_MCP_URL=
MERGE_REGISTERED_USER_ID=
MERGE_TOOL_PACK_ID=
MERGE_API_KEY=
ARI_COLLECTOR_URL=http://localhost:4319
```

## What ARI records

When the connected path runs, ARI can record:

- tools returned by the selected Tool Pack
- Registered User and Tool Pack identifiers
- selected tool name
- tool arguments
- tool result or error
- latency and status
- correlation metadata for later audit work

The tool name and arguments must match the tools exposed by the selected Merge Tool Pack.
