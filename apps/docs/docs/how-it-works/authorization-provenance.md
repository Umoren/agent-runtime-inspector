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

The record should turn scattered logs into an inspectable path:

```text
request -> identity -> permission snapshot -> selected context -> excluded context -> tool scope -> arguments -> result -> audit record
```

## Policy outcomes

The event model should make policy outcomes explicit:

```text
allowed
excluded
redacted
blocked
requires approval
escalated
```

Those outcomes can appear in context events, argument checks, tool blocks, Merge rule violations, or future authorization decision events.
