# Agent Runtime Inspector

Agent Runtime Inspector is a local devtool for inspecting what happened during an AI agent run.

It answers three questions:

- What did the LLM know?
- What could the agent do?
- How did the request run?

The first connected path targets Merge Agent Handler. Mock traces are included so developers can understand the inspector before connecting credentials.

## First Public Build

- Local dashboard for one agent run
- CLI for starting the inspector and loading mock traces
- Collector API for trace events
- Merge Agent Handler adapter shape
- Vercel AI SDK instrumentation helpers
- Example app for a Merge-backed agent run

## Workspace

```text
apps/
  web/                         Local dashboard
packages/
  core/                        Trace schemas, types, aggregation
  collector/                   Local event collector
  cli/                         ari command
  merge/                       Merge Agent Handler adapter
  ai-sdk/                      Vercel AI SDK instrumentation
examples/
  vercel-ai-sdk-merge/         First connected example
docs/
  engineering-standards.md
  product-strategy.md
  comms-plan.md
```

## Quickstart

```bash
pnpm install
pnpm dev
```

In another terminal:

```bash
pnpm ari mock
```

The Merge-connected path can list tools with:

```bash
MERGE_AGENT_HANDLER_MCP_URL=
MERGE_REGISTERED_USER_ID=
MERGE_TOOL_PACK_ID=
MERGE_API_KEY=
```

`MERGE_API_KEY` is required for Agent Handler MCP requests. The example loads the nearest `.env` file automatically. Blank optional values are treated as unset.

To record one tool call, also set:

```bash
MERGE_TOOL_NAME=
MERGE_TOOL_ARGUMENTS_JSON='{}'
```

To record a live model path, also set:

```bash
ARI_MODEL_API_KEY=
ARI_MODEL_PROVIDER=anthropic
ARI_MODEL_NAME=claude-haiku-4-5-20251001
```

`ARI_MODEL_PROVIDER` supports `openai-compatible` and `anthropic`. `ARI_MODEL_BASE_URL` is optional. Leave it unset for Anthropic or OpenAI defaults.

For Anthropic, use an active Claude 4-family model:

- `claude-haiku-4-5-20251001` for the lowest-cost demo path.
- `claude-sonnet-4-6` for stronger issue drafting.

Then run:

```bash
pnpm example:merge
```

To run the GitHub issue workflow, set:

```bash
ARI_AGENT_WORKFLOW=github_issue
ARI_GITHUB_OWNER=
ARI_GITHUB_REPO=
ARI_GITHUB_LABELS_JSON='["ari-demo"]'
```

In this mode, the example records selected and excluded context, asks the configured model to draft a GitHub issue, then calls `github__create_issue` through Merge Agent Handler.

## Product Promise

See what your agent knew, what it could do, which provider/model handled the request, and what got logged for audit.

## Docs

- [Engineering standards](docs/engineering-standards.md)
- [Product strategy](docs/product-strategy.md)
- [Comms plan](docs/comms-plan.md)
- [Trace event model](docs/trace-event-model.md)
- [Merge Agent Handler setup](docs/merge-agent-handler-setup.md)
