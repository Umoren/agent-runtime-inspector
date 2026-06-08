# Agent Runtime Inspector

Connect your AI coding agent and see the full provenance of every tool call.

Agent Runtime Inspector is a local devtool for inspecting agent runs. It sits between an MCP-capable agent client and Merge Agent Handler, forwards tool access to Merge, and records the runtime path in a local dashboard.

```text
AI coding agent -> ARI MCP proxy -> Merge Agent Handler -> external tool
                     |
                     -> ARI collector -> dashboard
```

The first connected path targets Merge Agent Handler because tool execution is where agent systems need a clear audit trail: available tools, selected tool, arguments, result, latency, user/account scope, and errors.

## What ARI Shows

ARI organizes each run into three paths:

| Path | Question | Evidence |
| --- | --- | --- |
| Context path | What did the LLM know? | selected context, excluded context, permission reason |
| Action path | What could the agent do? | tool inventory, Tool Pack, Registered User, tool call, arguments, result |
| Model path | How did the request run? | provider, model, latency, token use, status |

For the Merge-backed path, the core loop is:

```text
Codex asks to use a tool
ARI lists Merge Agent Handler tools
Codex chooses a tool
ARI forwards the call to Merge
Merge executes the tool
ARI records the trace
```

That turns an agent action into something a developer can inspect after the run.

## Current Status

This is an early OSS build with three working modes:

- Mock mode: loads a complete sample run without credentials.
- Example mode: runs a scripted Merge Agent Handler workflow.
- Proxy mode: lets an MCP client connect to ARI first, then ARI forwards tool calls to Merge Agent Handler.

The first public build focuses on the action path. Gateway and Unified API support come later.

## Quickstart

Install dependencies:

```bash
pnpm install
```

Start the collector and dashboard:

```bash
pnpm dev
```

The dashboard runs on:

```text
http://localhost:3005
```

Load the sample trace from another terminal:

```bash
pnpm ari mock
```

Use mock mode first if you want to understand the dashboard before connecting Merge credentials.

## Live Merge Setup

Create a `.env` file in the repo root:

```bash
MERGE_AGENT_HANDLER_MCP_URL=
MERGE_REGISTERED_USER_ID=
MERGE_TOOL_PACK_ID=
MERGE_API_KEY=
ARI_COLLECTOR_URL=http://localhost:4319
```

These values connect ARI to one Merge Agent Handler Tool Pack and Registered User.

To record one direct tool call from the example runner, add:

```bash
MERGE_TOOL_NAME=
MERGE_TOOL_ARGUMENTS_JSON='{}'
```

Then run:

```bash
pnpm example:merge
```

The example loads the nearest `.env` file automatically. Blank optional values are treated as unset.

## GitHub Issue Example

ARI includes a connected workflow that creates a GitHub issue through Merge Agent Handler.

Add a model provider:

```bash
ARI_MODEL_PROVIDER=anthropic
ARI_MODEL_API_KEY=
ARI_MODEL_NAME=claude-haiku-4-5-20251001
```

Then add the GitHub target:

```bash
ARI_AGENT_WORKFLOW=github_issue
ARI_GITHUB_OWNER=Umoren
ARI_GITHUB_REPO=playlist-sorter
ARI_GITHUB_LABELS_JSON='["ari-demo"]'
```

Run the example:

```bash
pnpm example:merge
```

This workflow records selected and excluded context, asks the configured model to draft a GitHub issue, then calls `github__create_issue` through Merge Agent Handler.

## MCP Proxy Mode

Proxy mode is the direction of the product. An MCP client connects to ARI instead of connecting directly to Merge Agent Handler.

Start ARI:

```bash
pnpm dev
```

Start the proxy:

```bash
pnpm proxy
```

For MCP clients that spawn a command, use the silent form so package-manager output does not interfere with stdio:

```json
{
  "mcpServers": {
    "ari-merge": {
      "command": "pnpm",
      "args": ["--silent", "proxy"],
      "cwd": "/absolute/path/to/agent-runtime-inspector"
    }
  }
}
```

Once connected, the MCP client can list Merge Agent Handler tools and call them through ARI. The dashboard records the run as:

```text
run.started
tool.listed
tool.called
tool.completed
run.completed
```

## Codex Setup

Codex supports local stdio MCP servers. To connect Codex through ARI, add a project-scoped config:

```toml
# .codex/config.toml

[mcp_servers.ari_merge]
command = "pnpm"
args = ["--silent", "proxy"]
cwd = "/home/sammy/Desktop/sammy25/career/agent-runtime-inspector"
startup_timeout_sec = 20
tool_timeout_sec = 90
default_tools_approval_mode = "prompt"
enabled_tools = [
  "github__get_authenticated_user",
  "github__create_issue"
]
```

Then start a fresh Codex session from the ARI repo and check MCP status:

```text
/mcp
```

First test:

```text
Use ari_merge to call github__get_authenticated_user.
```

Then test a tool call that changes GitHub state:

```text
Use ari_merge to create a GitHub issue in Umoren/playlist-sorter for a checkout failure after SSO login.
```

ARI should record the tool inventory, selected tool, arguments, result, latency, and audit events in the dashboard.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start collector and dashboard |
| `pnpm ari mock` | Load the sample trace |
| `pnpm proxy` | Start the local MCP proxy |
| `pnpm example:merge` | Run the Merge Agent Handler example |
| `pnpm typecheck` | Typecheck the workspace |
| `pnpm test` | Run tests |

## Workspace

```text
apps/
  web/                         Local dashboard
packages/
  core/                        Trace schemas, types, aggregation
  collector/                   Local event collector
  cli/                         ari command
  merge/                       Merge Agent Handler adapter
  proxy/                       Local MCP proxy for Merge Agent Handler
  ai-sdk/                      Vercel AI SDK instrumentation helpers
examples/
  vercel-ai-sdk-merge/         Connected Merge example
docs/
  engineering-standards.md
  product-strategy.md
  comms-plan.md
```

## Product Direction

ARI is moving toward a local provenance layer for AI coding agents.

The product goal is simple:

```text
An agent used a tool. Show the path.
```

That path should include what the agent saw, what it chose, what it sent, what changed, what failed, and what got logged for audit.

## Docs

- [Engineering standards](docs/engineering-standards.md)
- [Product strategy](docs/product-strategy.md)
- [Comms plan](docs/comms-plan.md)
- [Trace event model](docs/trace-event-model.md)
- [Merge Agent Handler setup](docs/merge-agent-handler-setup.md)
