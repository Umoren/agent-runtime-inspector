# What is ARI?

Agent Runtime Inspector is a local permission and audit gateway for AI agents.

It sits between an agent and upstream MCP servers. ARI retrieves permitted context, asks a policy engine whether an exact action is allowed, forwards allowed calls, blocks denied calls before execution, and records the evidence locally.

```text
AI agent -> ARI gateway -> upstream MCP server -> external system
               |  |
               |  -> policy engine
               -> local collector -> dashboard
```

ARI is built for OSS builders who want a concrete record around agent work before sending trace data to a hosted vendor.

## Why local-first?

Hosted observability tools help teams debug and monitor LLM and agent systems. ARI focuses on the earlier boundary: the first provenance record around an agent run should be inspectable on the developer's machine.

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

ARI supports a generic Streamable HTTP MCP upstream. Merge Agent Handler is an optional adapter rather than a core product dependency.

## What ARI does not claim

ARI does not expose or prove a model's private reasoning. It records external runtime evidence: selected context, excluded context, tool availability, tool calls, model calls, command results, and run status.

That boundary is intentional. The goal is to make the inspectable runtime path clear without pretending the trace proves more than it records.
