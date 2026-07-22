# Communications plan

## Current story

ARI now enforces the action boundary it records.

The public question is:

> When an agent calls a tool, can you see what it was allowed to know, what stayed out, which policy approved the call, and whether a denied action reached the external service?

The strongest material comes from the real gateway path: trusted identity, selected and excluded context, an exact tool call, the policy decision, and the upstream result.

## Content sequence

1. Show the permission problem with one concrete agent action.
2. Explain where ARI sits between an MCP client and upstream server.
3. Demonstrate an allow and a deny against the same tool boundary.
4. Open the dashboard and follow the shared decision IDs.
5. State what the run proves and what remains outside ARI's observation boundary.

## Evidence to publish

- A short gateway diagram.
- One recorded allowed action.
- One denied action where the upstream call count remains zero.
- The linked context, authorization, and tool events.
- Setup commands that reproduce the local run.

Avoid describing ARI as a finished governance platform. The current build is an early local gateway with a tested generic authorization path. The Gmail integration becomes public evidence only after it creates a real draft end to end.

## Builder outreach

Ask for builders who already have one of these problems:

- an MCP tool that changes an external system;
- sensitive context near the agent workflow;
- action rules that differ by user or purpose;
- a need to review why an action was allowed;
- trace data that cannot leave the developer's machine unchanged.

The useful checkpoint is a small integration test, not a broad partnership conversation. Connect one workflow, define one policy boundary, inspect one run, and decide what the trace still cannot explain.
