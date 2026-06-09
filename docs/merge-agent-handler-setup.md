# Merge Agent Handler Setup

Agent Runtime Inspector supports mock traces and a Merge Agent Handler connected action path.

The connected path needs:

```bash
MERGE_AGENT_HANDLER_MCP_URL=
MERGE_REGISTERED_USER_ID=
MERGE_TOOL_PACK_ID=
MERGE_API_KEY=
```

`MERGE_API_KEY` is required for Agent Handler MCP requests. Merge sends it as:

```text
Authorization: Bearer <YOUR_API_KEY>
```

To record one tool call, add:

```bash
MERGE_TOOL_NAME=
MERGE_TOOL_ARGUMENTS_JSON='{}'
```

To record a live model path, add:

```bash
ARI_MODEL_API_KEY=
ARI_MODEL_PROVIDER=anthropic
ARI_MODEL_NAME=claude-haiku-4-5-20251001
```

`ARI_MODEL_PROVIDER` supports `openai-compatible` and `anthropic`. `ARI_MODEL_BASE_URL` is optional. Leave it unset for Anthropic or OpenAI defaults.

Use one of Anthropic's active Claude 4-family models for the Anthropic path:

- `claude-haiku-4-5-20251001` for the lowest-cost live model path.
- `claude-sonnet-4-6` for a stronger model path.

Avoid retired or deprecated model IDs such as `claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`, and `claude-sonnet-4-20250514`.

To let the model draft a GitHub issue and then create it through Merge Agent Handler, add:

```bash
ARI_AGENT_WORKFLOW=github_issue
ARI_GITHUB_OWNER=
ARI_GITHUB_REPO=
ARI_GITHUB_LABELS_JSON='["ari-test"]'
```

This workflow calls `github__create_issue`, so use a repository where creating a test issue is acceptable.

## What The Inspector Shows

The connected action path records:

- selected context
- excluded context
- provider/model selection
- model latency and token usage when a model provider is configured
- Registered User
- Tool Pack
- tools returned by Agent Handler
- tool name and arguments when `MERGE_TOOL_NAME` is set
- tool result, latency, and status when the call completes
- local run id
- local trace events
- correlation metadata for later audit work

## Start Locally

```bash
pnpm install
pnpm ari dev
```

In another terminal:

```bash
pnpm --filter @ari/example-vercel-ai-sdk-merge dev
```

Then open:

```text
http://localhost:3005
```

## Mock Mode

Use mock mode to understand the dashboard before connecting Merge:

```bash
pnpm ari mock
```

## Connected Mode

Start with tool listing:

```bash
MERGE_AGENT_HANDLER_MCP_URL="https://..."
MERGE_REGISTERED_USER_ID="..."
MERGE_TOOL_PACK_ID="..."
pnpm --filter @ari/example-vercel-ai-sdk-merge dev
```

Then call one selected tool:

```bash
MERGE_AGENT_HANDLER_MCP_URL="https://..."
MERGE_REGISTERED_USER_ID="..."
MERGE_TOOL_PACK_ID="..."
MERGE_API_KEY="..."
ARI_MODEL_API_KEY="..."
ARI_MODEL_PROVIDER=anthropic
ARI_MODEL_NAME=claude-haiku-4-5-20251001
MERGE_TOOL_NAME="linear_create_issue"
MERGE_TOOL_ARGUMENTS_JSON='{"title":"Investigate SSO login failure","priority":"high"}'
pnpm --filter @ari/example-vercel-ai-sdk-merge dev
```

The tool name and arguments must match the tools exposed by your selected Tool Pack.

## Reference GitHub Issue Flow

This is a reference connected flow for the provenance architecture:

```bash
ARI_MODEL_API_KEY="..."
ARI_MODEL_PROVIDER=anthropic
ARI_MODEL_NAME=claude-haiku-4-5-20251001
ARI_AGENT_WORKFLOW=github_issue
ARI_GITHUB_OWNER="..."
ARI_GITHUB_REPO="..."
ARI_GITHUB_LABELS_JSON='["ari-test"]'
pnpm --filter @ari/example-vercel-ai-sdk-merge dev
```

The run records:

- context selected: support ticket and customer account
- context excluded: private Slack note
- model called: issue draft generation
- action listed: tools exposed by the Merge Tool Pack
- action called: `github__create_issue`
- action completed: GitHub issue result, latency, and correlation metadata
