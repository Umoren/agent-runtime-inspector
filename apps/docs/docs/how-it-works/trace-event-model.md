# Trace event model

The trace event stream is the product contract.

Every dashboard view should be derivable from the same event model:

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

The schema uses `runId` as the common boundary and adds decision identifiers:

```text
permissionSnapshotId
contextDecisionId
authorizationDecisionId
```

`permissionSnapshotId` and `contextDecisionId` begin with context retrieval. ARI creates `authorizationDecisionId` only when the agent attempts an upstream action. Together, the identifiers bind selected context, excluded context, the policy decision, and the later tool events.
