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

## Paths

### Context path

What the LLM knew.

This path records selected context, excluded context, source metadata, and permission rules.

### Action path

What the agent could do.

This path records Tool Packs, available tools, tool calls, arguments, results, latency, and blocked actions.

### Model path

How the request ran.

This path records provider/model choice, route reason, latency, token usage, cost, and failures.

### System path

The run lifecycle.

This path records when a run starts and completes.
