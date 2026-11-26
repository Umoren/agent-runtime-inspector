# Trace Codex GitHub calls through ARI

This demo connects Codex to the open source GitHub MCP server through ARI. ARI records the selected context, checks a policy, and forwards an allowed issue creation. It stores the full trace locally. The Cloud Trace exporter sends only its allowlisted fields.

ARI records MCP tools called through its gateway. It does not record Codex prompts or Codex's built-in shell and editor calls.

## Configure a test repository

Choose a disposable GitHub repository. Give a personal access token only the permissions needed to create issues in that repository. Do not use a production repository.

Edit `policy-data.json`. Set the owner and repository name for the test repository. The policy allows `issue_write` with `method=create` only when the call uses that repository and the approved demo context. It denies every other tool and repository.

## Start the GitHub MCP server

The official server supports Streamable HTTP on port `8082`:

```bash
docker run --rm \
  --publish 127.0.0.1:8082:8082 \
  --env GITHUB_TOOLSETS=issues \
  ghcr.io/github/github-mcp-server http
```

The server listens on loopback. It exposes the GitHub issues tool set. ARI's policy still decides which issue calls can reach GitHub.

## Start the local policy service

Run Open Policy Agent (OPA) with the demo policy and repository data:

```bash
opa run --server --addr localhost:8181 \
  examples/codex-github-mcp/policy.rego \
  examples/codex-github-mcp/policy-data.json
```

The decision URL is `http://localhost:8181/v1/data/ari/demo/decision`.

## Configure ARI

Copy `.env.example` to `.env` if you have not done so. Add these values to the ignored `.env` file. Replace the token placeholder. Do not commit `.env`.

```dotenv
ARI_PRINCIPAL_ID=demo-agent
ARI_PURPOSE=create_test_issue
ARI_CONTEXT_REGISTRY_PATH=examples/codex-github-mcp/context-registry.json
ARI_POLICY_DECISION_URL=http://localhost:8181/v1/data/ari/demo/decision
ARI_UPSTREAM_MCP_URL=http://localhost:8082
ARI_UPSTREAM_ID=github-demo
ARI_UPSTREAM_TYPE=github
ARI_UPSTREAM_HEADERS_JSON='{"Authorization":"Bearer YOUR_GITHUB_TOKEN"}'
```

The example context registry selects a checkout ticket and excludes a private finance note. The policy requires the selected checkout ticket before it allows an issue.

## Connect Codex and record a run

Add this project-scoped `.codex/config.toml`. Set `cwd` to the absolute path to this repository:

```toml
[mcp_servers.ari]
command = "pnpm"
args = ["--silent", "proxy"]
cwd = "/absolute/path/to/agent-runtime-inspector"
startup_timeout_sec = 20
tool_timeout_sec = 90
```

Start the collector and dashboard with `pnpm dev`. Start a new Codex session in the repository. Run `/mcp` and confirm that Codex lists `ari_get_context` and the GitHub issue tools.

Ask Codex to call `ari_get_context` for the demo checkout ticket. Then ask it to create one GitHub issue in the configured test repository with `issue_write` and `method=create`. The policy allows that call. Ask Codex to target a different repository for a second attempt. ARI records the denial and returns before the upstream call.

Inspect the run at `http://localhost:3005`. The local trace includes the decision IDs and the full tool arguments and result. The Cloud Trace exporter drops those payload fields.

## Export the safe trace

Use the exporter from the repository root:

```bash
pnpm --filter @ari/example-cloud-trace-export dev -- --latest --dry-run
pnpm --filter @ari/example-cloud-trace-export dev -- --latest
```

The first command prints the spans without sending them. The second sends the allowlisted fields to Cloud Trace.
