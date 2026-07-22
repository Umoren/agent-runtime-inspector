# Install ARI

1. Clone the repository and install its dependencies:

   ```bash
   git clone git@github.com:Umoren/agent-runtime-inspector.git
   cd agent-runtime-inspector
   pnpm install
   ```

2. Start the collector and dashboard:

   ```bash
   pnpm dev
   ```

3. Open `http://localhost:3005`.

The dashboard is now running. Configure an upstream MCP server, context provider, identity, and policy endpoint before starting `pnpm proxy`.

## Repository layout

```text
apps/web        Dashboard
apps/docs       Docusaurus docs site
packages/core   Trace event model and run helpers
packages/cli    Local CLI entrypoint
packages/collector
packages/merge
packages/proxy
examples/vercel-ai-sdk-merge
```

Build the documentation site with `pnpm docs:build`.
