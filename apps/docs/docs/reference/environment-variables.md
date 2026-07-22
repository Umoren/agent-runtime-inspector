# Environment variables

ARI uses environment variables for its collector, trusted gateway identity, upstream MCP server, policy engine, and optional adapters.

## Collector

| Variable | Purpose |
| --- | --- |
| `ARI_COLLECTOR_URL` | Collector endpoint used by examples and connected flows. |

## Gateway identity and context

| Variable | Purpose |
| --- | --- |
| `ARI_PRINCIPAL_ID` | Trusted principal bound to this gateway process. |
| `ARI_PURPOSE` | Trusted purpose bound to context retrieval and action policy input. |
| `ARI_CONTEXT_PROVIDER_CONFIG_PATH` | File or registry context-provider configuration. |
| `ARI_CONTEXT_REGISTRY_PATH` | Older JSON context registry. Do not set it with `ARI_CONTEXT_PROVIDER_CONFIG_PATH`. |
| `ARI_ALLOW_AGENT_DECLARED_CONTEXT` | Compatibility switch for `ari_record_context_scope`; defaults to `false`. |

## Upstream MCP server

| Variable | Purpose |
| --- | --- |
| `ARI_UPSTREAM_MCP_URL` | Streamable HTTP MCP endpoint. |
| `ARI_UPSTREAM_ID` | Stable operator-defined identifier used in policy input and traces. |
| `ARI_UPSTREAM_TYPE` | Operator-defined provider type used in policy input and traces. |
| `ARI_UPSTREAM_HEADERS_JSON` | Optional JSON object of request headers. Keep credentials out of committed files. |

For an OAuth-protected upstream MCP server, configure the client ID, client secret, redirect URL, and token path together. The scope is optional.

| Variable | Purpose |
| --- | --- |
| `ARI_UPSTREAM_OAUTH_CLIENT_ID` | OAuth client ID issued by the upstream provider. |
| `ARI_UPSTREAM_OAUTH_CLIENT_SECRET` | OAuth client secret. Keep it out of committed files and traces. |
| `ARI_UPSTREAM_OAUTH_REDIRECT_URL` | Local callback URL with an explicit port, such as `http://127.0.0.1:4545/oauth/callback`. |
| `ARI_UPSTREAM_OAUTH_TOKEN_PATH` | Local path where ARI persists refreshable OAuth tokens. Use an ignored runtime directory such as `.ari/gmail-tokens.json`. |
| `ARI_UPSTREAM_OAUTH_SCOPE` | Optional space-delimited scope string requested during authorization. |

## Policy engine

| Variable | Purpose |
| --- | --- |
| `ARI_POLICY_DECISION_URL` | OPA data API decision endpoint. Missing configuration produces a default deny. |
| `ARI_POLICY_HEADERS_JSON` | Optional JSON object of policy-service request headers. |

## Optional Merge adapter

| Variable | Purpose |
| --- | --- |
| `MERGE_AGENT_HANDLER_MCP_URL` | MCP endpoint for Merge Agent Handler. |
| `MERGE_REGISTERED_USER_ID` | Registered User used for tool execution. |
| `MERGE_TOOL_PACK_ID` | Tool Pack that defines available tools. |
| `MERGE_API_KEY` | Bearer token for Agent Handler MCP requests. |
| `MERGE_TOOL_NAME` | Optional direct tool call name for examples. |
| `MERGE_TOOL_ARGUMENTS_JSON` | Optional JSON arguments for direct tool calls. |

## Model provider

| Variable | Purpose |
| --- | --- |
| `ARI_MODEL_PROVIDER` | Model provider key used by example flows. |
| `ARI_MODEL_API_KEY` | Provider API key. |
| `ARI_MODEL_NAME` | Model identifier. |
| `ARI_MODEL_BASE_URL` | Optional provider base URL for compatible APIs. |

Keep credentials in local environment files that are not published into traces or docs.
