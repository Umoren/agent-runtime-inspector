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

The payload includes the source identifier, source type, title, selection reason, permission rule, and decision identifiers.

## Excluded context

`context.excluded` records source evidence that did not enter the run.

This event shows that the runtime found a candidate source and kept it outside the model or action boundary for a stated reason. It does not include the source content.
