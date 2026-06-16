# Context path

The context path answers:

```text
What did the runtime select for the run?
What stayed out?
Why?
```

Context events can represent documents, records, local files, source snippets, summaries, or derived context objects.

## Selected context

`context.selected` records source evidence that entered the run.

Useful payload details include:

- source identifier
- source type
- title
- selection reason
- permission rule
- decision identifiers

## Excluded context

`context.excluded` records source evidence that did not enter the run.

This is first-class provenance. It shows that a candidate source was known and stayed outside the model or action boundary for a stated reason.
