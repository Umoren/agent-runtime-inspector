# Trace event types

ARI's core trace event types are grouped by path.

## System

```text
run.started
run.completed
```

## Context

```text
context.selected
context.excluded
```

## Action

```text
authorization.decided
tool.listed
tool.called
tool.completed
tool.blocked
```

## Model

```text
model.called
model.completed
```

All events share a base envelope with `id`, `runId`, `timestamp`, `path`, `source`, `type`, and typed `payload`.

`tool.listed` stores compact inventory evidence: `toolCount`, sorted tool names, and `inventoryHash`. Full tool descriptions and input schemas are used for the live MCP response but are not duplicated in the trace event.

`authorization.decided` records the trusted principal, purpose, upstream, exact tool, allow or deny result, policy identifier, version, and reason before execution.
