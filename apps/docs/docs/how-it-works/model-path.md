# Model path

The model path answers:

```text
How did the request run?
Which provider and model handled it?
What did it cost in latency and tokens?
```

The current event model includes:

```text
model.called
model.completed
```

Model events can record provider, model, task type, route reason, latency, token usage, estimated cost, status, and errors.

The current schema makes model selection visible in the trace. Policy-controlled model routing remains future work.
