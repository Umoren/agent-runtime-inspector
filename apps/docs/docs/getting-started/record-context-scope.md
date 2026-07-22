# Retrieve context through ARI

The main MCP path starts with `ari_get_context`. The gateway supplies the trusted principal and purpose from operator configuration; the agent supplies only the task and optional title.

```json
{
  "title": "Prepare an authorized customer response",
  "task": "Retrieve the context needed to prepare this response."
}
```

ARI retrieves candidate sources, evaluates source permissions, returns selected content, and returns summaries without content for excluded sources. It records `permissionSnapshotId` and `contextDecisionId` for the later action-policy check.

`ari_record_context_scope` remains a compatibility tool for clients that select context outside ARI. It is hidden and rejected unless the gateway operator sets `ARI_ALLOW_AGENT_DECLARED_CONTEXT=true`.
