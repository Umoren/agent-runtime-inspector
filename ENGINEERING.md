# Engineering Standards

This project is a production devtool, not a toy agent demo. The code should make agent runtime behavior easier to inspect, explain, and trust.

## TypeScript Rules

- Use strict TypeScript from day one.
- Keep `core` as the source of truth for trace schemas, domain types, and aggregation.
- Use discriminated unions for trace events.
- Use Zod at every external boundary: collector payloads, CLI config, Merge responses, mock trace imports.
- Use `unknown` for external input. Parse it before using it.
- Avoid `any`. If an `any` is needed, isolate it and explain why.
- Use explicit domain names: `recordToolCallStarted`, `buildRunSummary`, `groupEventsByPath`.
- Avoid vague names such as `processData`, `handleThing`, or `runPipeline`.

## Package Boundaries

Packages depend inward:

```text
web, cli, collector, merge, ai-sdk -> core
core -> zod only
```

`core` must not depend on UI, CLI, Merge, storage, or framework code.

## Runtime Model

The trace event model is the product contract. Every event includes:

- `id`
- `runId`
- `type`
- `path`
- `source`
- `timestamp`
- typed `payload`

The dashboard, CLI, replay, audit export, and examples all read from this event stream.

## Error Handling

Use `Result<T, E>` for expected product failures:

- missing config
- invalid trace payload
- Merge auth failure
- tool call rejected
- run not found

Throw only for programmer errors or impossible states.

## UI Rules

The dashboard should not invent product logic.

UI receives:

- run summary
- grouped path events
- selected event
- audit export data

Aggregation belongs in `packages/core`.

## Documentation Rules

Docs are part of the product.

Every public concept should answer:

- What is this?
- Why does a developer need it?
- What does it show during an agent run?
- How does it connect to Merge Agent Handler?
