# Connect Merge Agent Handler

Use Merge Agent Handler as an optional upstream adapter when you need its Registered User and Tool Pack model.

1. Add the Merge settings to `.env`:

```bash
MERGE_AGENT_HANDLER_MCP_URL=
MERGE_REGISTERED_USER_ID=
MERGE_TOOL_PACK_ID=
MERGE_API_KEY=
ARI_COLLECTOR_URL=http://localhost:4319
ARI_PRINCIPAL_ID=
ARI_PURPOSE=
ARI_CONTEXT_PROVIDER_CONFIG_PATH=
ARI_POLICY_DECISION_URL=
```

2. Start the collector and dashboard with `pnpm dev`.

3. Start the gateway in another terminal with `pnpm proxy`.

ARI lists the selected Tool Pack, checks the exact tool name and arguments through the configured policy endpoint, and forwards the call only after an allow decision.

## What ARI records

For authorization review, ARI records:

- authorization decision and policy identifier
- Registered User and Tool Pack identifiers
- tools returned by the selected Tool Pack
- selected tool name and arguments

For execution review, ARI records:

- tool result or error
- latency and status
- correlation metadata for later audit work

The tool name and arguments must match the tools exposed by the selected Merge Tool Pack.
