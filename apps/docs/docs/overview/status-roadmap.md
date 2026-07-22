# Current status and roadmap

ARI is an early open source build.

The current implementation provides local collection, audit inspection, ARI-owned file context retrieval, and policy-enforced MCP action forwarding.

## Gateway boundary

- Provider-neutral Streamable HTTP MCP upstream with an optional Merge adapter.
- Trusted principal and purpose from gateway configuration, not agent claims.
- ARI-owned file context retrieval through `ari_get_context`.
- OPA action policy with default-deny and fail-closed behavior.
- Persistent OAuth tokens for protected remote MCP servers.

## Inspection surface

- Local collector and dashboard for trace review.
- Context, action, model, and system event schemas.
- Explicit `authorization.decided` evidence before a call or block.
- Decision identifiers that bind context, authorization, and tool events.
- Collector health diagnostics and local trace cleanup.

## Roadmap

- Complete one real Gmail draft workflow through Google's remote MCP server and an external OPA policy.
- Add `ari_search_context` and `ari_get_permission_boundary` where a real provider requires them.
- Add approval decisions, redactions, and policy version export.
- Improve local developer-workspace capture for file reads, edits, command execution, and verification evidence.
- Add durable audit export for sharing or reviewing a run outside the local dashboard.

The next proof point is the Gmail draft workflow. The generic gateway and OAuth persistence are implemented, but the repository does not yet contain evidence of a real Gmail draft created through ARI.
