# Package architecture

ARI is organized as a pnpm workspace.

| Package | Role |
| --- | --- |
| `apps/web` | Dashboard for inspecting local runs. |
| `apps/docs` | Docusaurus documentation site. |
| `packages/core` | Trace event schemas, run grouping, and summaries. |
| `packages/collector` | Local collector API and trace store. |
| `packages/cli` | Local command entrypoint. |
| `packages/proxy` | Provider-neutral MCP gateway, context retrieval, policy evaluation, and action recording. |
| `packages/ai-sdk` | Helpers for recording model events around AI SDK usage. |

The trace event model is the shared contract. Runtime integrations may change, but the dashboard and documentation should describe evidence present in that stream.
