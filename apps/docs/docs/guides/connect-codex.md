# Connect Codex through ARI

Codex can use local stdio MCP servers. In that setup, ARI runs as the MCP server command, retrieves permitted context, checks policy, and forwards allowed calls to the configured upstream MCP server.

The shape is:

```text
Codex -> local ARI MCP gateway -> upstream MCP server
```

A project-scoped Codex config can point at the ARI proxy command and restrict the tools exposed to the session.

```toml
[mcp_servers.ari]
command = "pnpm"
args = ["--silent", "proxy"]
cwd = "/absolute/path/to/agent-runtime-inspector"
startup_timeout_sec = 20
tool_timeout_sec = 90
default_tools_approval_mode = "prompt"
enabled_tools = ["ari_get_context"]
```

ARI exposes `ari_get_context` directly. Upstream tools are listed dynamically after the gateway connects. Keep Codex approval prompts enabled for early tests, especially for tools that can mutate external systems.
