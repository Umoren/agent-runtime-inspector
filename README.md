# Agent Runtime Inspector

Control what an AI agent may know and do, then inspect the evidence behind each decision.

Agent Runtime Inspector (ARI) is a local permission and audit gateway for AI agents. It retrieves permitted context, checks proposed actions through an external policy engine, forwards allowed Model Context Protocol (MCP) tool calls, and records the decision path locally.

```text
AI agent -> ARI gateway -> upstream MCP server -> external system
               |  |
               |  -> policy engine
               -> local collector -> dashboard
```

The gateway core uses provider-neutral contracts for upstream tools, identity, context, and policy. Merge Agent Handler remains available as an optional adapter.

## What ARI records

ARI organizes each run into four paths:

| Path | Question | Evidence |
| --- | --- | --- |
| Context | What entered the run? | selected context, excluded context, permission reason |
| Action | What could the agent do? | policy decision, upstream inventory, tool call, arguments, result |
| Model | How did the request run? | provider, model, latency, token use, status |
| System | What happened to the run? | start, completion, status, summary |

The current gateway flow is:

```text
agent asks ARI for context
ARI uses the configured principal and purpose
ARI returns permitted context and records what it withheld
agent requests an upstream MCP tool
ARI sends the exact action and arguments to the policy engine
ARI blocks the action or forwards it unchanged
ARI records the policy decision and execution result
```

The resulting trace shows what the agent was allowed to know, what stayed out, which policy allowed or denied the action, which arguments crossed the boundary, and what the upstream returned.

## Run ARI locally

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the collector and dashboard:

   ```bash
   pnpm dev
   ```

3. Open `http://localhost:3005`.

This starts the inspection surface. To forward MCP actions, configure and start the gateway in a second terminal.

## Configure the gateway

Create `.env` in the repository root:

```dotenv
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

Keep credentials in this ignored local file. If `ARI_POLICY_DECISION_URL` is missing or the policy service fails, ARI denies every upstream action.

Start the gateway:

```bash
pnpm proxy
```

## Connect an MCP client

Point an MCP-capable agent at ARI instead of the upstream server:

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

The silent command matters for stdio clients because package-manager output can corrupt the protocol stream.

Once connected, the client sees `ari_get_context` and the forwarded upstream tools. Call `ari_get_context` before an upstream tool:

```json
{
  "task": "Prepare a response using the context permitted for this gateway."
}
```

For an allowed action, the dashboard records:

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

For a denied action, `tool.blocked` replaces the call and completion events. ARI returns before calling the upstream server.

## Connect Codex

Add a project-scoped `.codex/config.toml`:

```toml
[mcp_servers.ari]
command = "pnpm"
args = ["--silent", "proxy"]
cwd = "/absolute/path/to/agent-runtime-inspector"
startup_timeout_sec = 20
tool_timeout_sec = 90
```

Start a new Codex session from the repository and run `/mcp` to confirm that ARI and its upstream tools are available. ARI still requires context and an explicit policy allow decision before it forwards an upstream action.

## What works now

The current open source build includes a provider-neutral Streamable HTTP MCP upstream and persistent OAuth tokens for protected servers. It also includes:

- trusted gateway identity and ARI-owned file context retrieval;
- Open Policy Agent (OPA) authorization with default-deny behavior;
- an optional Merge Agent Handler adapter;
- local event collection and an audit-focused dashboard.

The generic authorization boundary is covered by tests. The Gmail demo includes policy and context configuration, but it has not yet created a real Gmail draft end to end.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the collector and dashboard. |
| `pnpm proxy` | Start the local MCP gateway. |
| `pnpm example:merge` | Run the Merge Agent Handler example. |
| `pnpm docs:dev` | Start the documentation site. |
| `pnpm docs:build` | Build the documentation site. |
| `pnpm typecheck` | Typecheck the workspace. |
| `pnpm test` | Run the tests. |

## Workspace

```text
apps/
  web/                         Local dashboard
  docs/                        Docusaurus documentation site
packages/
  core/                        Trace schemas, types, aggregation
  collector/                   Local event collector
  cli/                         ari command
  merge/                       Optional Merge Agent Handler adapter
  proxy/                       MCP, context, policy, and OAuth gateway
  ai-sdk/                      Vercel AI SDK instrumentation helpers
examples/
  vercel-ai-sdk-merge/         Connected Merge example
demos/
  gmail-outreach/              OPA policy for a reviewable Gmail draft
```

## Documentation

- [Documentation site](https://ari.umoren.xyz)
- [Engineering standards](ENGINEERING.md)
- [Trace event model](docs/trace-event-model.md)
- [Action authorization handoff](docs/action-authorization-handoff.md)
- [Articles](docs/articles/README.md)

ARI does not expose or prove a model's private reasoning. It records observable runtime evidence.

## License

MIT. See [LICENSE](LICENSE).
