# Trace event model

The trace event stream is the product contract.

Every dashboard view should be derivable from the same event model:

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

The current schema uses `runId` as the common boundary. The stronger provenance model adds durable decision identifiers:

```text
permissionSnapshotId
contextDecisionId
authorizationDecisionId
```

Those identifiers let the trace bind selected context, excluded context, authorization checks, and later tool calls.
