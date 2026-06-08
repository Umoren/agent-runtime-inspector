# Product Strategy

## Product

Agent Runtime Inspector is a local devtool for developers building AI agents with Merge Agent Handler.

The product:

> An AI agent ran. Show me what happened.

## First Audience

- Developers building agents with MCP
- Developers evaluating Merge Agent Handler
- Developers using Vercel AI SDK for agent workflows
- Backend engineers who need logs, traces, and auditability around agent runs

## Strategic Goal

Get 10-20 developers to try Merge through the OSS tool.

The tool should not replace Merge. It should make Merge-powered agent runs easier to inspect and explain.

## First Public Build

The first public build centers on the action path:

- Tool Pack
- Registered User
- MCP tool listing
- MCP tool call
- arguments
- result
- latency
- local trace
- audit-friendly export

Mock traces explain the full three-path concept before a developer connects credentials.

## Next Product Layer

ARI should become a local MCP proxy, not only a dashboard that receives events from example scripts.

The target runtime path:

```text
agent client -> ARI MCP proxy -> Merge Agent Handler -> external tools
                   |
                   -> ARI collector and dashboard
```

This lets Codex, Claude Code, Cursor, or a Vercel AI SDK app connect to ARI as the MCP server. ARI forwards tool listing and tool calls to Merge Agent Handler, then records the runtime evidence automatically:

- tools listed
- tool selected
- arguments sent
- result returned
- latency
- errors
- Registered User
- Tool Pack
- correlation metadata

This is the product layer that turns ARI from a passive dashboard into an inspector for actual agent sessions.

## MCP Proxy Milestone

The next milestone keeps the scope narrow:

- ARI starts a local MCP server.
- An MCP client connects to ARI instead of connecting directly to Merge Agent Handler.
- ARI forwards tool listing to Merge Agent Handler.
- ARI forwards tool calls to Merge Agent Handler.
- ARI records action-path trace events for the forwarded session.
- The dashboard shows the run without requiring an example script to emit events.

Acceptance checks:

- `ari dev` starts the collector and dashboard.
- `ari proxy` starts the local MCP proxy.
- An MCP client can list Merge Agent Handler tools through ARI.
- An MCP client can call one Merge Agent Handler tool through ARI.
- The dashboard records `run.started`, `tool.listed`, `tool.called`, `tool.completed`, and `run.completed`.
- Tool errors are recorded as failed tool executions.
- Raw provider output stays available behind the raw event log.

Out of scope for this milestone:

- Merge Gateway.
- Merge Unified API.
- npm publishing.
- multiple connected examples.
- full production observability.

## Three Paths

```text
context path -> what the LLM knew
action path  -> what the agent could do
model path   -> how the request ran
```

## Positioning

Agent Runtime Inspector helps developers see:

- what context entered the LLM
- what tools the agent could use
- which tool the agent called
- which provider/model handled the request
- what got recorded for audit
