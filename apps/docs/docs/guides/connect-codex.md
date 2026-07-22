# Connect Codex through ARI

1. Add this project-scoped `.codex/config.toml`:

The shape is:

```text
Codex -> local ARI MCP gateway -> upstream MCP server
```

```toml
[mcp_servers.ari]
command = "pnpm"
args = ["--silent", "proxy"]
cwd = "/absolute/path/to/agent-runtime-inspector"
startup_timeout_sec = 20
tool_timeout_sec = 90
```

2. Replace `cwd` with the absolute path to this repository.

3. Start a new Codex session in the repository and run `/mcp`.

Codex should list `ari_get_context` and the tools returned by ARI's configured upstream server. Do not set `enabled_tools = ["ari_get_context"]` if Codex also needs to call those upstream tools. In Codex configuration, `enabled_tools` is an allowlist.

ARI retrieves permitted context, checks policy, and forwards only allowed calls. Keep the gateway's policy narrow while testing tools that can change external systems.
