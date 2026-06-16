# Action path

The action path answers:

```text
What could the agent do?
What did it call?
What came back?
```

For Merge-backed execution, ARI records Tool Pack, Registered User, available tools, selected tool, arguments, result, latency, status, and correlation metadata.

## Core events

```text
tool.listed
tool.called
tool.completed
tool.blocked
```

The action path becomes more valuable when tool events share the same decision identifiers as the context and authorization events that preceded them.

```text
context.selected -> contextDecisionId: ctx_123
tool.called -> contextDecisionId: ctx_123
tool.completed -> contextDecisionId: ctx_123
```
