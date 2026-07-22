# CLI commands

Run local commands through `pnpm ari`:

| Command | Purpose |
| --- | --- |
| `ari dev` | Start the collector and dashboard. |
| `ari init` | Create a local ARI config file. |
| `ari proxy` | Start the local ARI MCP authorization gateway. |
| `ari replay <runId>` | Print a dashboard URL for a stored run. |

For example:

```bash
pnpm ari init
pnpm ari dev
```

Root workspace scripts provide shortcuts for local development and docs:

| Script | Purpose |
| --- | --- |
| `pnpm docs:dev` | Start the Docusaurus docs site. |
| `pnpm docs:build` | Build the static docs site. |
| `pnpm docs:serve` | Serve a built docs site locally. |
