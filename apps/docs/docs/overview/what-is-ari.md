# What is ARI?

Agent Runtime Inspector (ARI) is a local permission and audit gateway for AI agents.

It sits between an agent and upstream MCP servers. ARI retrieves permitted context, asks a policy engine whether an exact action is allowed, forwards allowed calls, blocks denied calls before execution, and records the evidence locally.

```text
AI agent -> ARI gateway -> upstream MCP server -> external system
               |  |
               |  -> policy engine
               -> local collector -> dashboard
```

ARI is for open source builders who want to inspect an agent run before sending trace data to a hosted service.

## Why local-first?

Hosted observability tools help teams debug and monitor large language model (LLM) and agent systems. ARI focuses on an earlier boundary: the first provenance record around an agent run should be inspectable on the developer's machine.

An agent trace can contain retrieved context, tool arguments, customer records, repository details, internal docs, permission decisions, and excluded context. That trace is no longer harmless telemetry. It can become a copy of the sensitive workflow the agent touched.

ARI keeps that first record local so a builder can inspect what happened, decide what should be redacted, and choose what is safe to export or share.

## What ARI records

ARI organizes a run into four paths:

| Path | Question | Evidence |
| --- | --- | --- |
| Context | What entered the run? | selected context, excluded context, permission reason |
| Action | What could the agent do? | authorization decision, policy, tool inventory, arguments, result |
| Model | How did the request run? | provider, model, latency, token use, status |
| System | What happened to the run? | start, completion, status, summary |

ARI supports a provider-neutral Streamable HTTP MCP upstream. The trace includes only tool calls routed through ARI. Codex model prompts and native shell or editor calls are outside this boundary.

## What ARI does not claim

ARI does not expose or prove a model's private reasoning. It records context decisions and MCP tool calls that pass through its gateway. Instrumented integrations can emit model events. Codex prompts and native shell or editor calls remain outside this trace.

The trace shows the observable runtime path without claiming more than the recorded evidence can prove.
