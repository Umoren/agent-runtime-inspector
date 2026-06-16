# CLI commands

Command names are being cleaned up, so treat this as a lightweight reference until the CLI surface is finalized.

The intended command groups are:

| Command | Purpose |
| --- | --- |
| `ari dev` | Start the collector and dashboard. |
| `ari init` | Create a local ARI config file. |
| `ari proxy` | Start the local MCP proxy for Merge Agent Handler. |
| `ari replay <runId>` | Print a dashboard URL for a stored run. |

Root workspace scripts provide shortcuts for local development and docs:

| Script | Purpose |
| --- | --- |
| `pnpm docs:dev` | Start the Docusaurus docs site. |
| `pnpm docs:build` | Build the static docs site. |
| `pnpm docs:serve` | Serve a built docs site locally. |
