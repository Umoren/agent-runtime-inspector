# Why provenance for agents?

Agent systems compress several backend responsibilities into one runtime flow.

An agent can read context, choose a tool, send arguments to another system, receive a result, and generate a response. The user sees a conversation. The builder still needs the operational record behind that conversation.

Provenance connects those events into one record.

It also gives the trace a boundary. Agent traces can carry the same sensitive material the agent touched: retrieved context, tool arguments, customer records, repository details, internal docs, permission decisions, and excluded context. A useful provenance layer should make that record inspectable before it leaves the developer's machine.

## Questions about context and permission

For an agent run, ARI is designed to help answer:

- What context was selected?
- What candidate context was excluded or withheld?
- Which identity and permission boundary were used?
- Which tools were available?

## Questions about execution

- Which policy allowed or denied the action?
- Which tool did the agent call?
- What arguments and result were recorded?
- Which model path ran?
- What can the trace prove, and what can it not prove?

## Why exclusion matters

The trace should not only show what entered the run. It should also show context that was evaluated and kept out.

Excluded context is evidence. It can prove that a source existed, was considered by the runtime boundary, and stayed outside the model or action path for a stated reason.

That is especially important for enterprise and developer workflows where private notes, credentials, scoped customer data, or unrelated local files may exist near the work.
