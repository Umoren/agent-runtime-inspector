# Connect Codex to GitHub MCP through ARI

This guide connects Codex to the open source [GitHub MCP server](https://github.com/github/github-mcp-server) through ARI. The server supports [Streamable HTTP](https://github.com/github/github-mcp-server/blob/main/docs/streamable-http.md), which ARI uses for its upstream connection.

```text
Codex -> ARI -> GitHub MCP server -> GitHub
```

ARI records only MCP tool calls that pass through its gateway. Codex model prompts and native shell or editor calls do not pass through ARI and do not appear in its trace.

## Configure the upstream

Set the upstream values in the ignored root `.env` file:

```dotenv
ARI_UPSTREAM_MCP_URL=http://localhost:8082
ARI_UPSTREAM_ID=github-demo
ARI_UPSTREAM_TYPE=github
ARI_UPSTREAM_HEADERS_JSON='{"Authorization":"Bearer YOUR_GITHUB_TOKEN"}'
ARI_CONTEXT_REGISTRY_PATH=examples/codex-github-mcp/context-registry.json
ARI_PRINCIPAL_ID=demo-agent
ARI_PURPOSE=create_test_issue
ARI_POLICY_DECISION_URL=http://localhost:8181/v1/data/ari/demo/decision
```

The GitHub MCP server listens on `http://localhost:8082` in the example. The token in `ARI_UPSTREAM_HEADERS_JSON` must have permission to create issues in the test repository. Keep it in the ignored `.env` file. Do not commit it.

`ARI_UPSTREAM_MCP_URL`, `ARI_UPSTREAM_ID`, and `ARI_UPSTREAM_TYPE` are required for the upstream. `ARI_UPSTREAM_HEADERS_JSON` is optional when the endpoint needs no custom headers. See the [environment variable reference](../reference/environment-variables.md) for OAuth settings and policy headers.

## Allow issue creation in one repository

ARI denies calls by default until the policy endpoint returns an explicit allow. Configure an Open Policy Agent (OPA) data endpoint in `ARI_POLICY_DECISION_URL`. Use a policy that matches the upstream, tool, operation, owner, and repository. Store the allowed owner and repository in policy data so you can set them without changing the policy code.

The example policy lives in `examples/codex-github-mcp/policy.rego`. It allows `issue_write` with `method=create` only when the owner and repository match `policy-data.json` and ARI selected the demo checkout ticket. Start OPA with both files:

```bash
opa run --server --addr localhost:8181 \
  examples/codex-github-mcp/policy.rego \
  examples/codex-github-mcp/policy-data.json
```

Set the test repository owner and name in `policy-data.json`. Do not use a production repository. The default rule denies every other tool, operation, owner, and repository. GitHub also checks the token's permissions.

## Start ARI and connect Codex

Start the collector and dashboard:

```bash
pnpm dev
```

Start ARI's MCP gateway in another terminal:

```bash
pnpm proxy
```

Add this project-scoped `.codex/config.toml`:

```toml
[mcp_servers.ari]
command = "pnpm"
args = ["--silent", "proxy"]
cwd = "/absolute/path/to/agent-runtime-inspector"
startup_timeout_sec = 20
tool_timeout_sec = 90
```

Replace `cwd` with the absolute path to your checkout. Start a new Codex session in the repository and run `/mcp`. Codex should list `ari_get_context` and the GitHub MCP tools returned by ARI.

Call `ari_get_context` before the action. Ask Codex to create one issue in the configured test repository. Then ask it to target a different repository. ARI allows the first call and denies the second before the GitHub MCP server receives it. The local trace records each decision and tool result.

Open `http://localhost:3005` and inspect the run. The trace covers the tools routed through ARI. It does not cover Codex prompts, direct GitHub use outside the gateway, or Codex native shell and editor operations.
