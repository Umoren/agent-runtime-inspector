# Open the dashboard

The dashboard is the main inspection surface for ARI runs.

It shows:

- run summary and status
- context path events
- action path events
- model path events
- system lifecycle events
- raw event payloads for debugging

The local dashboard currently runs from `apps/web`. The default development port used by the repo is `3005`.

```text
http://localhost:3005
```

Use the dashboard to inspect whether a trace answers the provenance questions you care about, not only whether the run succeeded.
