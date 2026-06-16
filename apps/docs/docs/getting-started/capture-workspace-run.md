# Capture a workspace run

Developer agents do not only call external APIs. They also inspect files, apply patches, run tests, and summarize local changes.

ARI's developer-workspace direction is to record a local runtime path around that work:

```text
selected workspace context
excluded workspace context
local actions
command results
verification evidence
run summary
```

This surface is still evolving during cleanup. The product goal is stable: let a developer inspect the chain from project context to local action to verification result.

## What the record should show

- Which project files entered the run.
- Which candidate sources stayed out.
- Which local operations were available.
- Which commands ran.
- What verification evidence supports the final result.
- What the trace cannot prove.
