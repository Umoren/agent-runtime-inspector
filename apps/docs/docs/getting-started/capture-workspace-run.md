# Developer-workspace capture status

ARI does not yet capture a complete developer-workspace run. The current gateway records context retrieval and upstream MCP actions. Direct file reads, patches, shell commands, and test results remain outside that path unless another integration emits them.

The planned record is:

```text
selected workspace context
excluded workspace context
local actions
command results
verification evidence
run summary
```

This is roadmap work, not a supported setup path.

## Planned evidence

- Which project files entered the run.
- Which candidate sources stayed out.
- Which local operations were available.
- Which commands ran.
- What verification evidence supports the final result.

The run should also state what the recorded evidence cannot prove.
