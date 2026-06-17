# Current status and roadmap

ARI is an early open source build.

The current implementation focuses on local collection, dashboard inspection, trace events, and a context-scoped MCP proxy path through Merge Agent Handler.

## Current surface

- Local collector for trace events.
- Dashboard for inspecting runs, event paths, permission scope, and collector diagnostics.
- Trace event schemas for context, action, model, and system paths.
- Merge Agent Handler client and MCP proxy path.
- Required context-scope recording through `ari_record_context_scope` before forwarded tool calls.
- Context/action binding through `permissionSnapshotId`, `contextDecisionId`, `authorizationDecisionId`, and `authorizationRule`.
- Collector health and log diagnostics, including a local trace clear action for stale or incompatible rows.
- Vercel AI SDK example for recording model and action events.
- Public docs deployment configured for `https://ari.umoren.xyz`.
- Long-form architecture articles for the product direction.

## Roadmap

- Add end-to-end examples that show ARI inspecting real tool-backed agent workflows.
- Expand connector coverage examples for repository, knowledge-base, research, and spreadsheet-backed work.
- Move from agent-declared context scope toward ARI-owned context retrieval.
- Add ARI context tools such as `ari_search_context`, `ari_get_context`, and `ari_get_permission_boundary`.
- Add stronger policy checks around tool scope, tool arguments, redactions, blocks, and rule violations.
- Improve local developer-workspace capture for file reads, edits, command execution, and verification evidence.
- Add durable audit export for sharing or reviewing a run outside the local dashboard.

The product direction is not just to show that a tool ran. The goal is to show which context and permission boundary justified the action.
