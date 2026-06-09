# Trace Event Model

The trace event stream is the product contract.

Every view in the dashboard comes from the same event model:

```text
run.started
context.selected
context.excluded
tool.listed
tool.called
tool.completed
tool.blocked
model.called
model.completed
run.completed
```

Every event includes:

- `id`
- `runId`
- `timestamp`
- `path`
- `source`
- `type`
- typed `payload`

The current schema uses `runId` as the common boundary. The stronger provenance model will add durable decision ids so context, authorization, and action events can be bound explicitly:

```text
permissionSnapshotId
contextDecisionId
authorizationDecisionId
```

The goal is not only to show that a tool ran. The event stream should prove which context and permission boundary justified the action.

## Paths

### Context path

What the LLM knew.

This path records selected context, excluded context, source metadata, and permission rules.

The context path should support ARI-owned retrieval:

```text
agent asks ARI for context
ARI evaluates source permissions
ARI records selected context
ARI records excluded context
ARI returns only allowed context to the agent
```

Excluded context is first-class evidence. It proves that a candidate source existed, was evaluated, and was withheld from the model because the requester or purpose did not satisfy the source permission rule.

### Action path

What the agent could do.

This path records Tool Packs, available tools, tool calls, arguments, results, latency, and blocked actions.

The action path should bind tool calls back to context and authorization decisions:

```text
context.selected -> contextDecisionId: ctx_123
context.excluded -> contextDecisionId: ctx_123
tool.called -> contextDecisionId: ctx_123
tool.completed -> contextDecisionId: ctx_123
```

For Merge-backed execution, action events also carry Tool Pack, Registered User, tool arguments, result, latency, status, and correlation metadata.

### Model path

How the request ran.

This path records provider/model choice, route reason, latency, token usage, cost, and failures.

### System path

The run lifecycle.

This path records when a run starts and completes.

## Authorization Provenance

Authorization provenance is the binding layer across context and action.

For an agent action, ARI should be able to answer:

```text
what was the agent allowed to know
what was withheld
which identity and permission snapshot were evaluated
which tool scope was available
which arguments passed checks
which action ran
what result came back
what got logged for audit
```

This turns scattered logs into an inspectable provenance record:

```text
request -> identity -> permission snapshot -> selected context -> excluded context -> tool scope -> arguments -> result -> audit record
```

## Policy Outcomes

The event model should make policy outcomes explicit:

```text
allowed
excluded
redacted
blocked
requires approval
escalated
```

These outcomes can appear in context events, argument checks, tool blocks, Merge rule violations, or future authorization decision events.
