# System path

The system path records the run lifecycle.

```text
run.started
run.completed
```

`run.started` gives the dashboard a title, run id, timestamp, optional user id, and optional scenario.

`run.completed` records final status and an optional summary.

System events are intentionally small. They define the run boundary that the other paths attach to.
