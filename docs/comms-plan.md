# Comms Plan

## This Week's Article Goal

Target the Agentic AI Foundation developer-experience conversation through the practical question:

> When an agent calls a tool, can you see what it was allowed to know, what was withheld, and why the call was permitted?

This is a provenance article, but not another provenance essay. The piece should come from ARI's real MCP proxy path: context scope recorded by the agent, selected context, excluded context, Tool Pack, Registered User, forwarded tool call, arguments, result, and audit record.

The AAIF/DX bridge:

- Goose-style runtimes make agents useful for developers.
- MCP gives agents a standard way to connect to tools and context.
- ARI explores the provenance record around that work: what the agent was allowed to know, what it could not use, what it could do, what it did, and what evidence supports the final result.

Do not frame this as a toy external action demo. The real surface is permission-linked MCP tool execution.

## Public Build Sequence

### Post 1

I wrote about the AI integration layer.

Now I am building the inspector for it.

The first question:

When an AI agent runs, can you see what happened?

### Post 2

Three questions define the inspector:

- What did the LLM know?
- What could the agent do?
- How did the request run?

### Post 3

Share the first dashboard wireframe:

- run overview
- context path
- action path
- model path
- raw event log
- audit export

### Post 4

Show Merge Agent Handler connected path:

- Registered User
- Tool Pack
- MCP endpoint
- tool list
- tool call
- result
- local trace

### Post 5

Ask for 10 builders:

I am looking for 10 people building AI agents with Merge Agent Handler, MCP, or Vercel AI SDK.

I want to see where agent debugging breaks in your setup.

## Launch

Launch with:

- GitHub repo
- 90-second demo video
- one Merge-connected example
- MCP proxy walkthrough with selected context, excluded context, and one real forwarded tool call
- setup in under five minutes
