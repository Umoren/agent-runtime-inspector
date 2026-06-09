# Product Strategy

## Product

Agent Runtime Inspector is a local provenance layer for AI agents.

The product:

> An AI agent ran. Show me what happened.

The sharper positioning:

> Connect an AI agent and see the provenance of its context, tools, and actions.

ARI is not only a trace dashboard. It is the layer that records what an agent was allowed to know, what it was allowed to do, what it actually did, and what got logged for audit.

## First Audience

- Developers building agents with MCP
- Developers evaluating Merge Agent Handler
- Developers using Vercel AI SDK for agent workflows
- Backend engineers who need logs, traces, and auditability around agent runs

## Strategic Goal

Get 10-20 developers building agent systems to try ARI as the provenance layer around their agent runs.

The tool should not replace execution layers such as Merge Agent Handler. It should make agent context, permission boundaries, and tool execution easier to inspect and explain.

## First Public Build

The first public build centers on the action path:

- Tool Pack
- Registered User
- MCP tool listing
- MCP tool call
- arguments
- result
- latency
- local trace
- audit-friendly export

Mock traces explain the full three-path concept before a developer connects credentials.

## Next Product Layer

ARI should become a local MCP proxy, not only a dashboard that receives events from example scripts.

The target runtime path:

```text
agent client -> ARI MCP proxy -> Merge Agent Handler -> external tools
                   |
                   -> ARI collector and dashboard
```

This lets Codex, Claude Code, Cursor, or a Vercel AI SDK app connect to ARI as the MCP server. ARI forwards tool listing and tool calls to Merge Agent Handler, then records the runtime evidence automatically:

- tools listed
- tool selected
- arguments sent
- result returned
- latency
- errors
- Registered User
- Tool Pack
- correlation metadata

This is the product layer that turns ARI from a passive dashboard into an inspector for actual agent sessions.

## ARI-Owned Context Retrieval

The stronger product model is not only:

```text
agent client -> ARI MCP proxy -> Merge Agent Handler -> external tools
```

ARI also needs to own the context path before the action path.

Target runtime path:

```text
agent asks ARI for context
  -> ARI evaluates the permission boundary
  -> ARI records selected and excluded context
  -> ARI returns only allowed context to the agent
  -> agent calls a tool through ARI's action layer
  -> ARI binds the tool call back to the context decision
```

This turns ARI from a tool-call trace viewer into a provenance layer that can answer:

```text
what was the agent allowed to know -> what was withheld -> what tool did it call -> why was that call permitted -> what got logged
```

### Context MCP Tools

ARI should expose its own MCP tools alongside the Merge-forwarded tools:

```text
ari_search_context
ari_get_context
ari_get_permission_boundary
```

The agent uses these before calling a Merge tool.

Example:

```text
Use ARI to get context for this escalation, then create an external issue through ARI's action layer.
```

The agent calls:

```json
{
  "tool": "ari_get_context",
  "arguments": {
    "task": "Create a GitHub issue from this support escalation",
    "requesterId": "samuel",
    "purpose": "support_to_github_issue"
  }
}
```

ARI returns only allowed context:

```json
{
  "contextDecisionId": "ctx_123",
  "selected": [
    {
      "sourceId": "support_ticket_438",
      "title": "Checkout failure after SSO login",
      "content": "Allowed support ticket summary..."
    }
  ],
  "excludedSummary": [
    {
      "sourceId": "private_finance_note_991",
      "reason": "Requester is not in finance scope"
    }
  ]
}
```

ARI should not return excluded source content to the agent. It should return the fact that a source was excluded and the permission reason.

### Source Registry

ARI needs a source registry to retrieve from.

The first implementation can be local and deterministic:

```text
support_ticket_438
customer_account_102
private_finance_note_991
security_incident_doc_12
```

Each source should include metadata:

```json
{
  "sourceId": "private_finance_note_991",
  "sourceType": "slack_message",
  "title": "Private finance escalation note",
  "classification": "restricted",
  "requiredScopes": ["finance_channel_member"],
  "content": "..."
}
```

Later, the source registry can become adapters:

```text
GitHub issues
Slack messages
Zendesk tickets
Linear issues
Notion docs
internal docs
```

The product model should remain the same.

### Permission Evaluator

ARI needs a permission evaluator that can decide:

```text
allowed
excluded
redacted
requires approval
blocked
```

The evaluator compares:

```text
requester identity
purpose
source metadata
required scopes
current permission snapshot
```

Example requester snapshot:

```json
{
  "requesterId": "samuel",
  "scopes": ["support_team_member", "github_issue_writer"]
}
```

Example decisions:

```text
support_ticket -> selected
customer_account -> selected
private_finance_note -> excluded
security_incident_doc -> excluded
```

ARI records both the selected context and the excluded context.

### Binding Context To Tool Calls

The trace cannot be:

```text
context happened somewhere
tool call happened somewhere
```

It needs to show:

```text
this tool call was made under this context decision
```

The event model should gain durable ids:

```text
permissionSnapshotId
contextDecisionId
authorizationDecisionId
```

Events can then link:

```text
context.selected -> contextDecisionId: ctx_123
context.excluded -> contextDecisionId: ctx_123
tool.called -> contextDecisionId: ctx_123
tool.completed -> contextDecisionId: ctx_123
```

The dashboard can say:

```text
github__create_issue was called using context decision ctx_123.

Selected:
- Support ticket

Excluded:
- Private finance note

Tool scope:
- GitHub Tool Pack
- Registered User: Umoren
```

### Merge Boundary

Merge owns the action layer:

```text
Tool Pack
Registered User
available tools
tool execution
argument redaction
blocked calls
tool result
latency
status
```

ARI owns the context/provenance layer:

```text
context retrieval
permission boundary
selected context
excluded context
binding context decision to tool call
local provenance dashboard
```

Together:

```text
ARI context provenance + Merge action provenance = full agent-run provenance
```

### Canonical Provenance Flow

User request:

```text
Create a GitHub issue from this support escalation.
```

ARI retrieves:

```text
selected support ticket
selected customer account
excluded private finance note
excluded internal security note
```

The agent receives:

```text
only selected support context
```

The agent calls:

```text
an external tool through ARI's action layer
```

ARI shows:

```text
selected context -> excluded context -> permission boundary -> tool call -> result
```

## MCP Proxy Milestone

The next milestone keeps the scope narrow:

- ARI starts a local MCP server.
- An MCP client connects to ARI instead of connecting directly to Merge Agent Handler.
- ARI forwards tool listing to Merge Agent Handler.
- ARI forwards tool calls to Merge Agent Handler.
- ARI records action-path trace events for the forwarded session.
- The dashboard shows the run without requiring an example script to emit events.

Acceptance checks:

- `ari dev` starts the collector and dashboard.
- `ari proxy` starts the local MCP proxy.
- An MCP client can list Merge Agent Handler tools through ARI.
- An MCP client can call one Merge Agent Handler tool through ARI.
- The dashboard records `run.started`, `tool.listed`, `tool.called`, `tool.completed`, and `run.completed`.
- Tool errors are recorded as failed tool executions.
- Raw provider output stays available behind the raw event log.

Out of scope for this milestone:

- Merge Gateway.
- Merge Unified API.
- npm publishing.
- multiple connected examples.
- full production observability.

## Product Signals From Builders

### Telephony Agent Provenance

Sameer Srivastava's Agentline use case points to a high-trust version of the same provenance problem: voice agents that make outbound calls.

In a telephony agent flow, the user or business system asks the agent to act, the agent reads business context, decides a call is needed, invokes an outbound-call tool, and the telephony layer returns call logs, transcript, result, and status.

ARI should not replace telephony logs. The telephony platform should remain the system of record for call audio, duration, transcript, provider status, and call delivery metadata. ARI should record the agent-side provenance around the call:

- original request
- selected business context
- excluded private context
- outbound-call tool invoked
- tool arguments, with phone numbers and sensitive values redacted
- call/session id returned by the telephony layer
- transcript/result passed back into the agent loop
- final status: succeeded, failed, escalated, or requires human review

The path should be inspectable as:

```text
request -> selected business context -> excluded private context -> outbound_call args -> call/session id -> transcript/result -> status
```

Telephony logs show the call. Provenance shows why the agent made it, what it used to decide, and what came back into the agent loop.

This matters because voice agents touch customers directly. A product team needs to answer "why did the agent call this person?" with more than a transcript.

### Async Tool Calls

David Kramaley's HelperOne use case points to the next action-path model: always-on agents where the action does not finish inside the same request cycle.

ARI currently models the simple sync path:

```text
tool.called -> tool.completed
```

That works for normal MCP tool calls where the agent calls a tool and receives the result during the same run. It is not enough for long-running tasks, scheduled work, recurring jobs, background briefings, outbound calls, or webhook-driven follow-up.

For always-on agents, a user might ask:

- "Call me at 3pm."
- "Send me a briefing every morning."
- "Watch my inbox and call me if something urgent arrives."
- "Prioritize tomorrow's tasks."

The agent accepts the task now, but the meaningful action happens later. ARI needs a durable correlation model for that path:

```text
request -> tool accepted -> job/session id -> later callback/status -> result -> follow-up action
```

Merge Agent Handler can provide part of this through tool-call events, logs, webhooks, Registered User, Tool Pack, arguments, result, status, redactions, and failures. ARI's job is to preserve the agent-run context around that stream:

- which original request created the async action
- which context was used or excluded
- which tool accepted the work
- which job/session id should be followed
- which webhook, poll result, or callback completed the work
- which follow-up model or tool action happened because of the result

This is the right model for always-on assistants because the user may see the final action hours later. The product needs to explain why that later action happened and which original request/context produced it.

### Permission Scope And Excluded Context

Solomon Neas's security/audit use case points to the core governance question: the gap between what tool ran and what the agent was allowed to touch.

Logging the selected tool and arguments is the easy half. The useful audit record binds each tool call to the permission scope and context that justified it:

- what context the agent used
- what context the agent could not use
- which permission rule allowed selected context into the run
- which permission rule excluded sensitive context from the run
- which Tool Pack and Registered User scoped the available tools
- which arguments were sent after permission and security checks
- which redactions, blocks, or rule violations happened before execution

ARI already has first-class context events:

```text
context.selected
context.excluded
```

The next useful layer is to make the justification explicit in the run summary and action path, so an auditor can answer:

```text
what was the agent allowed to know -> what was withheld -> what tool did it call -> why was that call permitted -> what got logged
```

This matters because excluded context is often where the risk lives. A system that only shows the data the agent used can miss the more important evidence: the sensitive source it was not allowed to use, and the rule that kept it out.

## Three Paths

```text
context path -> what the LLM knew
action path  -> what the agent could do
model path   -> how the request ran
```

## Positioning

Agent Runtime Inspector helps developers see:

- what context entered the LLM
- what tools the agent could use
- which tool the agent called
- which provider/model handled the request
- what got recorded for audit

For the first Merge-backed path:

> Connect an MCP-capable agent to Merge Agent Handler through ARI, then see the provenance of every tool call: available tools, selected tool, arguments, result, latency, permission scope, and audit log.

The operating claim:

> AI agents should leave a provenance record developers and security teams can inspect.
