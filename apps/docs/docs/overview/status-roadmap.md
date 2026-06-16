# Current status and roadmap

ARI is an early open source build.

The current implementation focuses on local collection, dashboard inspection, trace events, and an action path through Merge Agent Handler. Commands and package boundaries are still being cleaned up, so this docs site keeps setup references intentionally light until that cleanup lands.

## Current surface

- Local collector for trace events.
- Dashboard for inspecting runs and event paths.
- Trace event schemas for context, action, model, and system paths.
- Merge Agent Handler client and MCP proxy path.
- Vercel AI SDK example for recording model and action events.
- Long-form architecture articles for the product direction.

## Roadmap

- Stronger context provenance with selected and excluded source evidence.
- Durable decision identifiers that bind context, authorization, and action events.
- Better local developer-workspace capture.
- More precise authorization provenance around tool scope and argument checks.
- Search and deployment hardening for the public docs site.

The product direction is not just to show that a tool ran. The goal is to show which context and permission boundary justified the action.
