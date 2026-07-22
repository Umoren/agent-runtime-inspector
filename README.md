# Agent Runtime Inspector

Control what an AI agent may know and do, then inspect the evidence behind every decision.

Agent Runtime Inspector is a local permission and audit gateway for AI agents. It retrieves permitted context, checks proposed actions through an external policy engine, forwards allowed MCP tool calls, and records the complete decision path locally.

```text
AI agent -> ARI gateway -> any upstream MCP server -> external system
               |  |
               |  -> policy engine
               -> local collector -> dashboard
```

Merge Agent Handler remains available as an optional upstream adapter. The gateway core uses provider-neutral upstream, identity, context, and policy contracts.

## What ARI Shows

ARI organizes each run into provenance paths:

| Path | Question | Evidence |
| --- | --- | --- |
| Context path | What did the LLM know? | selected context, excluded context, permission reason |
| Action path | What could the agent do? | policy decision, upstream inventory, tool call, arguments, result |
| Model path | How did the request run? | provider, model, latency, token use, status |
| System path | What happened to the run? | start, completion, status, summary |

The current core loop is:

```text
agent asks ARI for context
ARI uses the gateway's trusted principal and purpose
ARI returns permitted context and records withheld context
agent requests an upstream MCP tool
ARI sends the exact action and arguments to the configured policy engine
ARI blocks the action or forwards it unchanged
ARI records the policy decision and execution result
```

That turns an agent action into something a developer can inspect after the run: what the agent was allowed to know, what was withheld, which tool scope was available, which authorization rule permitted the call, which arguments were sent, and what result came back.

## Current Status

This early OSS build includes a provider-neutral HTTP MCP upstream, trusted gateway identity, ARI-owned file context retrieval, OPA policy evaluation, fail-closed action forwarding, an optional Merge adapter, local collection, and an audit-oriented dashboard.

The main context path is `ari_get_context`. Agent-declared context through `ari_record_context_scope` is disabled unless the gateway operator explicitly enables compatibility mode.

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

## Gateway Setup

Create a `.env` file in the repo root:

```bash
ARI_COLLECTOR_URL=http://localhost:4319
ARI_PRINCIPAL_ID=
ARI_PURPOSE=
ARI_CONTEXT_PROVIDER_CONFIG_PATH=
ARI_UPSTREAM_MCP_URL=
ARI_UPSTREAM_ID=
ARI_UPSTREAM_TYPE=
ARI_UPSTREAM_HEADERS_JSON='{}'
ARI_POLICY_DECISION_URL=
```

`ARI_UPSTREAM_HEADERS_JSON` and the policy URL are operator configuration. Keep credentials in an ignored local environment file. If no policy endpoint is configured, ARI denies every upstream action.

## MCP Proxy Mode

An MCP-capable agent connects to ARI instead of connecting directly to the upstream MCP server.

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
    "ari": {
      "command": "pnpm",
      "args": ["--silent", "proxy"],
      "cwd": "/absolute/path/to/agent-runtime-inspector"
    }
  }
}
```

Once connected, the MCP client sees:

```text
ari_get_context
<forwarded upstream MCP tools>
```

Before calling an upstream tool, the agent asks ARI for context:

```json
{
  "task": "Prepare a response using the context permitted for this gateway."
}
```

The principal and purpose come from trusted gateway configuration, not this tool input. When the agent attempts an upstream action, ARI asks the policy engine for an allow or deny decision. The dashboard records:

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

For a denial, `tool.blocked` replaces the call and completion events. The upstream server is not called.

## Codex Setup

Codex supports local stdio MCP servers. To connect Codex through ARI, add a project-scoped config:

```toml
# .codex/config.toml

[mcp_servers.ari]
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

Ask the connected agent to call `ari_get_context` before using an upstream tool. ARI will deny every upstream action until context exists and the configured policy engine returns an explicit allow decision.

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
  proxy/                       Provider-neutral MCP and policy gateway
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

ARI is a local permission and audit gateway for AI agents.

The product goal is simple:

```text
An agent requested an action. Enforce the boundary and show the evidence.
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
