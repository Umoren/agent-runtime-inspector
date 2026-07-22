# Merge Agent Handler setup

Merge Agent Handler is an optional upstream adapter for Agent Runtime Inspector (ARI). The adapter preserves Merge's Registered User and Tool Pack metadata while using the same context and policy boundary as other upstream MCP servers.

```text
MCP client -> ARI gateway -> Merge Agent Handler -> external tool
                 |  |
                 |  -> policy engine
                 -> collector -> dashboard
```

## Configure the adapter

Add these values to the repository's ignored `.env` file:

```dotenv
ARI_COLLECTOR_URL=http://localhost:4319
ARI_PRINCIPAL_ID=
ARI_PURPOSE=
ARI_CONTEXT_PROVIDER_CONFIG_PATH=
ARI_POLICY_DECISION_URL=

MERGE_AGENT_HANDLER_MCP_URL=
MERGE_REGISTERED_USER_ID=
MERGE_TOOL_PACK_ID=
MERGE_API_KEY=
```

`MERGE_API_KEY` is sent as a bearer token. ARI also sends the Registered User and Tool Pack identifiers required by the adapter.

Configure either `ARI_CONTEXT_PROVIDER_CONFIG_PATH` or the older `ARI_CONTEXT_REGISTRY_PATH`. Do not set both. The [file-backed context provider](./file-context-provider.md) is the preferred path for repository and workspace files.

The gateway denies every attempted action until `ARI_POLICY_DECISION_URL` returns an explicit allow decision.

## Start ARI

1. Start the collector and dashboard:

   ```bash
   pnpm dev
   ```

2. Start the MCP gateway in another terminal:

   ```bash
   pnpm proxy
   ```

3. Point an MCP-capable client at the ARI stdio command:

   ```json
   {
     "mcpServers": {
       "ari": {
         "command": "pnpm",
         "args": ["--silent", "proxy"],
         "cwd": "/absolute/path/to/agent-runtime-inspector"
       }
     }
   }
   ```

The client receives ARI's context tool and the tools returned by the configured Merge Tool Pack.

## Retrieve context before acting

Call `ari_get_context` before an upstream tool:

```json
{
  "task": "Create a GitHub issue from this support escalation."
}
```

ARI takes the principal and purpose from trusted gateway configuration. It returns selected content, summarizes excluded sources without returning their content, and records the context decision.

When the client calls a Merge tool, ARI sends the policy engine:

- the trusted principal and purpose;
- the Tool Pack as the upstream identifier;
- the exact tool name and arguments;
- the permission snapshot and context decision;
- the selected source identifiers and types.

ARI forwards the call only after an allow decision. A deny decision records `tool.blocked` and returns before Merge receives the request.

## Inspect the run

Open `http://localhost:3005` and select the run. An allowed path contains:

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

The action events include the permission, context, and authorization decision IDs. Merge-specific events also keep the Registered User and Tool Pack identifiers.

## Run the scripted example

The Vercel AI SDK example can record model events and a selected Merge action:

```bash
pnpm example:merge
```

Use `MERGE_TOOL_NAME` and `MERGE_TOOL_ARGUMENTS_JSON` to select a direct call. The tool name and argument shape must match the configured Tool Pack. Use an account where the selected side effect is safe.
