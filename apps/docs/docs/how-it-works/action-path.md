# Action path

The action path answers:

```text
What could the agent do?
Which policy allowed or denied it?
What did it call?
What came back?
```

ARI records the upstream identity, tool count and names, inventory hash, authorization decision, selected tool, arguments, result, latency, status, and correlation metadata for actions routed through its gateway. Codex model prompts and native shell or editor calls are outside this trace.

ARI computes the inventory hash from the complete runtime tool definitions, including descriptions and input schemas. Those definitions still go to the MCP client, while the trace keeps only compact evidence. The recorded inventory describes the ARI proxy boundary; downstream client allowlists are outside the current observation boundary.

## Core events

```text
authorization.decided
tool.listed
tool.called
tool.completed
tool.blocked
```

Decision identifiers connect the tool events to the context and authorization events that preceded them.

```text
context.selected -> contextDecisionId: ctx_123
authorization.decided -> contextDecisionId: ctx_123, authorizationDecisionId: auth_123
tool.called -> contextDecisionId: ctx_123, authorizationDecisionId: auth_123
tool.completed -> contextDecisionId: ctx_123, authorizationDecisionId: auth_123
```
