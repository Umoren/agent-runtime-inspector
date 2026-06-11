# Agent Runtime Inspector

Connect an AI agent and inspect the provenance of its context, tools, and actions.

Agent Runtime Inspector is a local provenance layer for AI agents. It sits between an MCP-capable agent runtime and the systems the agent touches, records the runtime path locally, and makes the permission boundary around each action inspectable.

```text
AI agent runtime -> ARI provenance layer -> tool execution layer -> external system
                         |
                         -> local collector -> dashboard
```

The first execution-layer integration targets Merge Agent Handler because tool execution is where agent systems need a clear audit trail: available tools, selected tool, arguments, result, latency, user/account scope, redactions, blocks, and errors.

## What ARI Shows

ARI organizes each run into provenance paths:

| Path | Question | Evidence |
| --- | --- | --- |
| Context path | What did the LLM know? | selected context, excluded context, permission reason |
| Action path | What could the agent do? | tool inventory, Tool Pack, Registered User, tool call, arguments, result |
| Model path | How did the request run? | provider, model, latency, token use, status |
| System path | What happened to the run? | start, completion, status, summary |

For the Merge-backed action path, the current core loop is:

```text
agent asks to use a tool
ARI lists Merge Agent Handler tools
agent chooses a tool
ARI forwards the call to Merge
Merge executes the tool
ARI records the trace
```

That turns an agent action into something a developer can inspect after the run. The product direction extends this with ARI-owned context retrieval so each tool call can be bound to what the agent was allowed to know, what was withheld, and which permission boundary justified the action.

## Current Status

This is an early OSS build with three working modes:

- Mock mode: loads a complete sample run without credentials.
- Example mode: runs a scripted Merge Agent Handler workflow.
- Proxy mode: lets an MCP-capable agent connect to ARI first, then ARI forwards tool calls to Merge Agent Handler and records the action path.

The current build focuses on the action path. The next core layer is context provenance: ARI-owned retrieval, permission evaluation, selected/excluded context, and binding the resulting context decision to later tool calls.

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

## Reference GitHub Issue Flow

ARI includes a reference workflow that creates a GitHub issue through Merge Agent Handler.

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
ARI_GITHUB_LABELS_JSON='["ari-test"]'
```

Run the example:

```bash
pnpm example:merge
```

This workflow records selected and excluded context, asks the configured model to draft a GitHub issue, then calls `github__create_issue` through Merge Agent Handler. It is a reference flow for the architecture, not the product boundary.

## MCP Proxy Mode

Proxy mode is the current runtime path. An MCP-capable agent connects to ARI instead of connecting directly to Merge Agent Handler.

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

Once connected, the MCP client can list Merge Agent Handler tools and call them through ARI. The dashboard records a complete action run as:

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
cwd = "/absolute/path/to/agent-runtime-inspector"
startup_timeout_sec = 20
tool_timeout_sec = 90
default_tools_approval_mode = "prompt"
enabled_tools = [
  "github__get_authenticated_user",
  "github__create_issue"
]
```

Replace `cwd` with the absolute path to your local checkout.

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
Use ari_merge to create a GitHub issue in Umoren/playlist-sorter titled "Test ARI MCP proxy provenance for Codex tool calls".

The issue body should say:

Codex created this issue through the ARI MCP proxy.

This test verifies that ARI records:
- the Merge tool inventory
- the selected GitHub tool
- the arguments Codex sent
- the result returned by Merge Agent Handler
- the latency and status of the tool call

After creating the issue, return the issue URL.
```

ARI should record the tool inventory, selected tool, arguments, result, latency, and audit events in the dashboard.

## Context Provenance Direction

The stronger ARI model is ARI-owned context retrieval:

```text
agent asks ARI for context
ARI evaluates the permission boundary
ARI records selected and excluded context
ARI returns only allowed context to the agent
agent calls a tool through ARI's action layer
ARI binds the tool call back to the context decision
```

That model lets ARI answer the audit question:

```text
what was the agent allowed to know -> what was withheld -> what tool did it call -> why was that call permitted -> what got logged
```

Merge Agent Handler remains the first action execution layer. ARI owns the context provenance, permission boundary, context/action binding, and local audit record.

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
  articles/                     Product essays and architecture notes
  engineering-standards.md
  product-strategy.md
  comms-plan.md
```

## Product Direction

ARI is a local provenance layer for AI agents.

The product goal is simple:

```text
An agent touched a system. Show the path.
```

That path should include the request, identity, permission snapshot, selected context, excluded context, model step, tool scope, tool call, arguments, result, policy decisions, and local audit record.

## Docs

- [Engineering standards](docs/engineering-standards.md)
- [Product strategy](docs/product-strategy.md)
- [Comms plan](docs/comms-plan.md)
- [Trace event model](docs/trace-event-model.md)
- [Merge Agent Handler setup](docs/merge-agent-handler-setup.md)
- [Articles](docs/articles/README.md)

## Articles

These essays explain the product architecture behind ARI:

- [The AI Integration Layer Is Becoming the New Backend](docs/articles/ai-integration-layer-new-backend/index.md)
- [Permission-Aware Retrieval for Enterprise AI Agents](docs/articles/permission-aware-retrieval-enterprise-ai-agents/index.md)
