# Current status and roadmap

ARI is an early open source build.

The current implementation provides local collection, audit inspection, ARI-owned file context retrieval, and policy-enforced MCP action forwarding.

## Current surface

- Local collector for trace events.
- Dashboard for inspecting runs, event paths, permission scope, and collector diagnostics.
- Trace event schemas for context, action, model, and system paths.
- Provider-neutral Streamable HTTP MCP upstream and optional Merge adapter.
- Trusted principal and purpose supplied by gateway configuration rather than agent claims.
- ARI-owned context retrieval through `ari_get_context`.
- OPA action-policy adapter with default-deny behavior.
- Explicit `authorization.decided` evidence before allowed or blocked tool calls.
- Context/action binding through permission, context, and authorization decision identifiers.
- Collector health and log diagnostics, including a local trace clear action for stale or incompatible rows.
- Vercel AI SDK example for recording model and action events.
- Public docs deployment configured for `https://ari.umoren.xyz`.
- Long-form architecture articles for the product direction.

## Roadmap

- Complete one real Gmail draft workflow through Google's remote MCP server and an external OPA policy.
- Add persistent OAuth support for remote MCP servers that require interactive user authorization.
- Add `ari_search_context` and `ari_get_permission_boundary` where a real provider requires them.
- Add approval decisions, redactions, and policy version export.
- Improve local developer-workspace capture for file reads, edits, command execution, and verification evidence.
- Add durable audit export for sharing or reviewing a run outside the local dashboard.

The product direction is not just to show that a tool ran. The goal is to show which context and permission boundary justified the action.
