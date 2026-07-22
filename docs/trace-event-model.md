# Trace event model

The trace event stream is the product contract.

Every view in the dashboard comes from the same event model:

```text
run.started
context.selected
context.excluded
authorization.decided
tool.listed
tool.called
tool.completed
tool.blocked
model.called
model.completed
run.completed
```

Every event includes:

```text
id
runId
timestamp
path
source
type
typed payload
```

The schema uses `runId` as the run boundary and durable decision ids so context, authorization, and action events can be bound explicitly:

```text
permissionSnapshotId
contextDecisionId
authorizationDecisionId
authorizationRule
```

The event stream shows that a tool ran and records the context and permission boundary that justified the action.

## Paths

### Context path

What context ARI returned or withheld.

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

This path records explicit policy decisions, compact upstream tool inventories, tool calls, arguments, results, latency, and blocked actions.

`tool.listed` persists the tool count, sorted tool names, and a SHA-256 hash of the full runtime inventory. Tool descriptions and input schemas remain available to the live MCP client but are not copied into every trace. The hash changes when the upstream names, descriptions, or schemas change.

The inventory is observed at ARI's proxy boundary. A downstream MCP client may apply an additional allowlist, so ARI does not describe the upstream inventory as the agent's final effective tool scope.

`authorization.decided` records the trusted principal, purpose, upstream, requested tool, allow or deny result, policy id, policy version, and reason. Context selection does not create this event. ARI creates it only when the agent attempts a specific action.

The action path binds tool calls back to context and authorization decisions:

```text
context.selected -> contextDecisionId: ctx_123
context.excluded -> contextDecisionId: ctx_123
authorization.decided -> contextDecisionId: ctx_123, authorizationDecisionId: auth_123
tool.called -> contextDecisionId: ctx_123, authorizationDecisionId: auth_123
tool.completed -> contextDecisionId: ctx_123, authorizationDecisionId: auth_123
```

Generic action events carry an upstream identifier. The optional Merge adapter also preserves Tool Pack and Registered User metadata for compatibility.

### Model path

How the request ran.

This path records provider/model choice, route reason, latency, token usage, cost, and failures.

### System path

The run lifecycle.

This path records when a run starts and completes.

## Authorization provenance

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

## Policy outcomes

The current event model records:

```text
allowed
excluded
blocked
```

Allowed and denied action outcomes appear in `authorization.decided`. A denial is followed by `tool.blocked`, and no upstream tool request is made.

Redaction, approval, and escalation outcomes remain roadmap work.
