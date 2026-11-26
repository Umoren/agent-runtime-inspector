# Engineering standards

Treat ARI as a production developer tool. The code should make agent runtime behavior easier to inspect and explain.

## TypeScript rules

- Use strict TypeScript from day one.
- Keep `core` as the source of truth for trace schemas, domain types, and aggregation.
- Use discriminated unions for trace events.
- Use Zod at every external boundary: collector payloads, CLI config, upstream MCP responses, mock trace imports.
- Use `unknown` for external input and parse it before use. Isolate and explain any unavoidable `any`.
## Naming rules

- Use explicit domain names such as `recordToolCallStarted`, `buildRunSummary`, and `groupEventsByPath`.
- Avoid vague names such as `processData`, `handleThing`, or `runPipeline`.

## Package boundaries

Packages depend inward:

```text
web, cli, collector, proxy, ai-sdk -> core
core -> zod only
```

`core` must not depend on UI, CLI, upstream providers, storage, or framework code.

## Runtime model

The trace event model is the product contract. Every event includes:

```text
id
runId
type
path
source
timestamp
typed payload
```

The dashboard, CLI, replay, audit export, and examples all read from this event stream.

## Error handling

Use `Result<T, E>` for expected product failures:

- missing config
- invalid trace payload
- upstream authentication failure
- tool call rejected
- run not found

Throw only for programmer errors or impossible states.

## UI rules

The dashboard should not invent product logic.

UI receives:

- run summary
- grouped path events
- selected event
- audit export data

Aggregation belongs in `packages/core`.

## Documentation rules

Docs are part of the product.

Every public concept should answer:

- What is this?
- Why does a developer need it?
- What does it show during an agent run?
- Where does it sit in the MCP and policy path?

Every setup guide should also state what the current implementation proves and which side effects or integrations remain untested.
