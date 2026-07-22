# Retrieve context through ARI

1. Configure `ARI_PRINCIPAL_ID`, `ARI_PURPOSE`, and a context provider.

2. Start the gateway with `pnpm proxy`.

3. Call `ari_get_context` with a task and optional title:

```json
{
  "title": "Prepare an authorized customer response",
  "task": "Retrieve the context needed to prepare this response."
}
```

The gateway supplies the principal and purpose. The agent cannot replace them in the tool input.

ARI retrieves candidate sources, evaluates source permissions, returns selected content, and returns summaries without content for excluded sources. It records `permissionSnapshotId` and `contextDecisionId` for the later action-policy check.

`ari_record_context_scope` remains a compatibility tool for clients that select context outside ARI. It is hidden and rejected unless the gateway operator sets `ARI_ALLOW_AGENT_DECLARED_CONTEXT=true`.
