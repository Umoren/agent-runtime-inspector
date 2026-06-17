# Social Launch Drafts

## X / Twitter

### Post 1

If your agent can call tools, the audit question changes.

It is not enough to know that `wikipedia__get_summary` or `github__create_issue` ran.

You also need to know what context the agent was allowed to use, what was withheld, which tool scope was available, and what arguments crossed the boundary.

That is what I am building with Agent Runtime Inspector.

### Post 2

One question applied AI engineers run into fast is:

When an agent touches another system, can I explain the path?

For a tool call, ARI records:

- selected context
- excluded context
- authorization rule
- available tools
- selected tool
- arguments
- result
- latency

The goal is a provenance record a developer can inspect.

### Post 3

I tested Agent Runtime Inspector with Codex connected through an MCP proxy.

The flow:

1. Codex records context scope.
2. ARI records selected and excluded context.
3. Codex calls a forwarded Merge Agent Handler tool.
4. ARI binds the tool call back to the context decision.

This is the shape I want for agent debugging: context -> permission -> tool -> result.

### Post 4

Most agent demos show the happy path.

The harder product question is what the system can prove after the action:

- what the agent knew
- what it could not use
- which tools it could see
- which tool it called
- what arguments it sent
- what came back

ARI is my open-source exploration of that audit trail.

## LinkedIn

AI agents need provenance, not just tool access.

I have been building Agent Runtime Inspector as an open-source local layer for inspecting agent runs.

The current path connects an MCP-capable agent through ARI, forwards tool calls to Merge Agent Handler, and records the evidence around the run.

In the latest build, ARI records:

- what context entered the run
- what context was explicitly withheld
- which authorization rule justified the action
- which Tool Pack and Registered User scoped the available tools
- which tool the agent called
- what arguments were sent
- what result came back
- whether the collector itself is healthy

The useful question is no longer only "did the tool run?"

For agent systems that touch customer data or external applications, the better question is:

What was the agent allowed to know, what was it allowed to do, what did it actually do, and what evidence exists after the run?

That is the direction I am taking ARI.
