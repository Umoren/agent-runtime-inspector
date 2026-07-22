# Authorization provenance

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

ARI creates the authorization decision when a specific action is attempted. The policy input includes the trusted principal, configured purpose, upstream identity, tool name, arguments, and selected context evidence.

The record turns scattered logs into an inspectable path:

```text
request -> trusted identity -> context decision -> policy decision -> tool call or block -> result -> audit record
```

## Current policy outcomes

ARI currently records:

```text
allowed
excluded
blocked
```

Selected context is recorded separately from these outcomes. Allowed and denied actions produce `authorization.decided`. A denied action also produces `tool.blocked` before any upstream mutation.

Redaction, approval, and escalation decisions remain roadmap work.
