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

For the Merge-backed MCP path, the current core loop is:

```text
agent records selected and excluded context through ARI
ARI records the permission snapshot, context decision, and authorization rule
ARI lists Merge Agent Handler tools under the configured Tool Pack and Registered User
agent chooses a forwarded tool
ARI forwards the call to Merge
Merge executes the tool
ARI records the linked trace
```

That turns an agent action into something a developer can inspect after the run: what the agent was allowed to know, what was withheld, which tool scope was available, which authorization rule permitted the call, which arguments were sent, and what result came back.

## Current Status

This is an early OSS build focused on one runtime path:

- Proxy mode: lets an MCP-capable agent connect to ARI first, then ARI forwards tool calls to Merge Agent Handler and records the action path.

The proxy exposes one ARI-owned MCP tool, `ari_record_context_scope`. The agent must call it before forwarded Merge tools. ARI then binds `tool.listed`, `tool.called`, and `tool.completed` to the recorded `permissionSnapshotId`, `contextDecisionId`, and `authorizationDecisionId`.

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

Once connected, the MCP client sees:

```text
ari_record_context_scope
<forwarded Merge Agent Handler tools>
```

Before calling a forwarded Merge tool, the agent calls `ari_record_context_scope` with:

```json
{
  "title": "Create issue from allowed project context",
  "authorizationRule": "selected_project_context_allows_issue_creation",
  "selected": [
    {
      "sourceId": "project-docs",
      "sourceType": "project_doc",
      "title": "Public project docs",
      "reason": "Needed to prepare the issue body.",
      "permissionRule": "project_read"
    }
  ],
  "excluded": [
    {
      "sourceId": "local-env",
      "sourceType": "secret_file",
      "title": ".env",
      "reason": "Credential material must not enter the tool call context.",
      "permissionRule": "no_secret_material"
    }
  ]
}
```

Then the agent calls a forwarded Merge tool. The dashboard records:

```text
run.started
context.selected
context.excluded
tool.listed
tool.called
tool.completed
run.completed
```

The action events carry the same permission/context/authorization IDs as the context events.

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
```

Replace `cwd` with the absolute path to your local checkout.

Start a fresh Codex session from the ARI repo and check MCP status:

```text
/mcp
```

First record context:

```text
Use ari_merge to call ari_record_context_scope for this run.

Selected context:
- sourceId: project-docs
- sourceType: project_doc
- title: Public project docs
- reason: Needed to prepare the tool call.
- permissionRule: project_read

Excluded context:
- sourceId: local-env
- sourceType: secret_file
- title: .env
- reason: Credential material must not enter tool arguments.
- permissionRule: no_secret_material

Authorization rule: selected_project_context_allows_tool_call
```

Then test a tool call that changes GitHub state:

```text
Use ari_merge to create a GitHub issue in Umoren/playlist-sorter titled "Test ARI MCP proxy provenance for Codex tool calls".

The issue body should say:

Codex created this issue through the ARI MCP proxy.

This test verifies that ARI records:
- selected context
- excluded context
- the authorization rule
- the Merge tool inventory
- the selected GitHub tool
- the arguments Codex sent
- the result returned by Merge Agent Handler
- the latency and status of the tool call

After creating the issue, return the issue URL.
```

ARI should record the context scope, tool inventory, selected tool, arguments, result, latency, and audit events in the dashboard.

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
| `pnpm proxy` | Start the local MCP proxy |
| `pnpm example:merge` | Run the Merge Agent Handler example |
| `pnpm docs:dev` | Start the Docusaurus documentation site |
| `pnpm docs:build` | Build the documentation site |
| `pnpm docs:serve` | Serve the built documentation site |
| `pnpm typecheck` | Typecheck the workspace |
| `pnpm test` | Run tests |

## Workspace

```text
apps/
  web/                         Local dashboard
  docs/                        Docusaurus documentation site
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

## License

MIT. See [LICENSE](LICENSE).
