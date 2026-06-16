# What is ARI?

Agent Runtime Inspector is a local provenance layer for AI agent runs.

It sits between an agent runtime and the systems the agent touches, records the runtime path locally, and gives builders a dashboard for inspecting what happened.

```text
AI agent runtime -> ARI provenance layer -> tool execution layer -> external system
                         |
                         -> local collector -> dashboard
```

ARI is built for OSS builders who want a concrete record around agent work without sending trace data to a hosted vendor.

## What ARI records

ARI organizes a run into four paths:

| Path | Question | Evidence |
| --- | --- | --- |
| Context | What entered the run? | selected context, excluded context, permission reason |
| Action | What could the agent do? | tool inventory, tool call, arguments, result |
| Model | How did the request run? | provider, model, latency, token use, status |
| System | What happened to the run? | start, completion, status, summary |

The first connected execution path targets Merge Agent Handler. ARI can sit in front of the handler, forward MCP tool calls, and record the action evidence around each call.

## What ARI does not claim

ARI does not expose or prove a model's private reasoning. It records external runtime evidence: selected context, excluded context, tool availability, tool calls, model calls, command results, and run status.

That boundary is intentional. The goal is to make the inspectable runtime path clear without pretending the trace proves more than it records.
