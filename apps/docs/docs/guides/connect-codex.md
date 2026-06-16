# Connect Codex through ARI

Codex can use local stdio MCP servers. In that setup, ARI runs as the MCP server command and forwards calls to Merge Agent Handler.

The shape is:

```text
Codex -> local ARI MCP server -> Merge Agent Handler
```

A project-scoped Codex config can point at the ARI proxy command and restrict the tools exposed to the session.

```toml
[mcp_servers.ari_merge]
command = "pnpm"
args = ["--silent", "proxy"]
cwd = "/absolute/path/to/agent-runtime-inspector"
startup_timeout_sec = 20
tool_timeout_sec = 90
default_tools_approval_mode = "prompt"
enabled_tools = [
  "github__get_authenticated_user",
  "github__create_issue"
]
```

Use a narrow tool list for early tests, especially for tools that can mutate external systems.
