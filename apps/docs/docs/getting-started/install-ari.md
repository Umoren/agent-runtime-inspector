# Install ARI

ARI is a pnpm TypeScript monorepo.

```bash
git clone git@github.com:Umoren/agent-runtime-inspector.git
cd agent-runtime-inspector
pnpm install
```

After the current command cleanup, this page should become the canonical quickstart. For now, use the repository README as the command source of truth if a script name changes.

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

The docs app is standalone inside the workspace and can be built as static assets.
