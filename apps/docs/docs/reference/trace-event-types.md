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
