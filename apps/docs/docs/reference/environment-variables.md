# Environment variables

ARI uses environment variables for local collector URLs, Merge Agent Handler credentials, and optional model-provider settings.

## Collector

| Variable | Purpose |
| --- | --- |
| `ARI_COLLECTOR_URL` | Collector endpoint used by examples and connected flows. |

## Merge Agent Handler

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
