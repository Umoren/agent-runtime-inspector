# Product strategy

## Product

Agent Runtime Inspector (ARI) is a local permission and audit gateway for AI agents.

The product promise is:

> An agent requested an action. Enforce the boundary and show the evidence.

ARI retrieves permitted context, checks an exact tool call through policy, blocks denied actions before execution, and records the path locally. The dashboard is the inspection surface for that boundary.

## First audience

- Developers connecting agents to Model Context Protocol (MCP) servers.
- Backend engineers responsible for agent permissions and external side effects.
- Teams that need a local record before sending traces to a hosted service.

The first useful feedback should come from builders with a real tool call and a real permission constraint. Generic interest in observability is less useful than a workflow where the agent can read sensitive context or mutate an external system.

## Current product boundary

| Layer | ARI owns | ARI does not own |
| --- | --- | --- |
| Identity | trusted principal and purpose for one gateway process | identity-provider login or organization membership |
| Context | candidate retrieval, source permission checks, selected and excluded evidence | a hosted enterprise search index |
| Action | policy check before forwarding, tool-call evidence, blocking | the upstream service's internal authorization |
| Audit | local event collection and run inspection | durable hosted retention or compliance certification |

The core flow is:

```text
agent asks ARI for context
  -> ARI evaluates source permissions
  -> ARI returns selected content and records exclusions
  -> agent attempts an upstream tool
  -> ARI sends the exact action to policy
  -> ARI blocks or forwards the call
  -> ARI records the decision and result
```

This boundary is stronger than a dashboard that reports a denied action after the side effect. ARI returns before the upstream call when policy denies it.

## What works now

The current build has five connected parts:

1. A file or registry context provider finds candidate sources.
2. A permission evaluator selects allowed context and records exclusions.
3. A provider-neutral action transport lists and calls upstream MCP tools.
4. An Open Policy Agent endpoint allows or denies the exact action.
5. A local collector and dashboard show the resulting evidence.

The gateway also has persistent OAuth token storage for protected remote MCP servers.

## Current milestone

The next milestone is one real Gmail draft created through Google's remote MCP server and the demo OPA policy.

The workflow should prove:

1. ARI retrieves only the approved outreach context.
2. OAuth survives a process restart without leaking tokens into the trace.
3. Policy permits `create_draft` for the approved recipient and denies send actions.
4. The draft reaches Gmail only after the allow decision.
5. The dashboard links context, authorization, tool call, and result through decision IDs.

The repository currently proves the generic gateway with tests. It does not yet prove this Gmail path end to end.

## Product sequence

### Do now

- Complete and record the Gmail draft workflow.
- Make the setup reproducible from the public documentation.
- Export one audit record that another person can inspect.
- Test the gateway with builders who have real permission constraints.

### Do later

- Add explicit approval, redaction, and escalation decisions.
- Add context search and permission-boundary tools when a provider needs them.
- Capture local file edits, shell commands, and verification evidence.
- Support asynchronous actions with durable job or session correlation.
- Add durable or hosted audit storage after the local record is trustworthy.

## Integration boundaries

ARI should remain provider-neutral.

```text
ARI = permission, provenance, and local audit gateway
upstream MCP server = tool catalog and execution
OPA = workflow-specific action policy
context provider = candidate retrieval and requester snapshot
```

Service-specific recipient rules, tool names, and argument checks belong in policy or adapter configuration. They should not enter the gateway core.

An external context system may later implement ARI's provider interface. ARI should not depend on a specific context engine before a real workflow requires it.

## Product signals to watch

The most useful adopter signals are concrete:

- a builder can connect an existing MCP client without changing the upstream server;
- a denied action never reaches the upstream service;
- an auditor can follow one context decision into one policy decision and tool result;
- a builder can explain what the trace proves and where its observation boundary ends;
- the gateway setup takes less effort than writing a one-off proxy for the same workflow.

The initial target remains 10 to 20 builders with real agent systems. Their failures should determine whether ARI invests next in approvals, asynchronous actions, workspace capture, or audit export.

## Operating principle

Do not broaden the product around hypothetical agent infrastructure. Add a new event, tool, or provider boundary only when a real workflow needs evidence the current model cannot express.
