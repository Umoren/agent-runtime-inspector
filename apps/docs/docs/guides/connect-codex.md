# Connect Codex to GitHub MCP through ARI

This guide connects Codex to the open source [GitHub MCP server](https://github.com/github/github-mcp-server) through ARI. The server supports [Streamable HTTP](https://github.com/github/github-mcp-server/blob/main/docs/streamable-http.md), which ARI uses for its upstream connection.

```text
Codex -> ARI -> GitHub MCP server -> GitHub
```

ARI records only MCP tool calls that pass through its gateway. Codex model prompts and native shell or editor calls do not pass through ARI and do not appear in its trace.

## Configure the upstream

Set the upstream values in the ignored root `.env` file:

```dotenv
ARI_UPSTREAM_MCP_URL=
ARI_UPSTREAM_ID=github
ARI_UPSTREAM_TYPE=github
ARI_UPSTREAM_HEADERS_JSON='{}'
ARI_POLICY_DECISION_URL=
```

Set `ARI_UPSTREAM_MCP_URL` to the Streamable HTTP endpoint for your GitHub MCP server. Set `ARI_UPSTREAM_ID` and `ARI_UPSTREAM_TYPE` to stable values that your policy uses. Add required authentication headers to `ARI_UPSTREAM_HEADERS_JSON` as a JSON object. Keep credentials in `.env`; do not commit them.

`ARI_UPSTREAM_MCP_URL`, `ARI_UPSTREAM_ID`, and `ARI_UPSTREAM_TYPE` are required for the upstream. `ARI_UPSTREAM_HEADERS_JSON` is optional when the endpoint needs no custom headers. See the [environment variable reference](../reference/environment-variables.md) for OAuth settings and policy headers.

## Allow issue creation in one repository

ARI denies calls by default until the policy endpoint returns an explicit allow. Configure an Open Policy Agent (OPA) data endpoint in `ARI_POLICY_DECISION_URL`. Use a policy that matches the upstream, tool, operation, owner, and repository. Store the allowed owner and repository in policy data so you can set them without changing the policy code.

For example, this Rego rule allows only issue creation with the GitHub MCP `issue_write` tool in the configured repository:

```rego
package ari.gateway

import rego.v1

default result := {
  "allow": false,
  "reason": "No policy allows this action.",
  "policyId": "ari.default_deny"
}

result := {
  "allow": true,
  "reason": "Issue creation is allowed in the configured repository.",
  "policyId": "ari.github.issue_create",
  "policyVersion": "1"
} if {
  input.upstream.id == "github"
  input.upstream.type == "github"
  input.action.name == "issue_write"
  input.action.arguments.method == "create"
  input.action.arguments.owner == data.ari.github_repository.owner
  input.action.arguments.repo == data.ari.github_repository.name
}
```

Set `data.ari.github_repository.owner` and `data.ari.github_repository.name` in your policy data. Do not use wildcard repository checks. The default rule denies other tools, operations, owners, and repositories. GitHub still checks the token's permissions.

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

Call `ari_get_context` before the action. ARI checks each upstream tool call against policy. A denial records `authorization.decided` and `tool.blocked`, then returns before the GitHub MCP server receives the call. An allow records the tool call and its result.

Open `http://localhost:3005` and inspect the run. The trace covers the tools routed through ARI. It does not cover Codex prompts, direct GitHub use outside the gateway, or Codex native shell and editor operations.
