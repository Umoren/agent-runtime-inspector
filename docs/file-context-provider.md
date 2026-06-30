# File-Backed Context Provider

The file-backed context provider lets ARI use repository or workspace files as agent context without hardcoding those files inside the MCP proxy.

The operating claim is:

```text
ARI retrieves context, records the permission decision, and binds that decision to later tool calls.
```

The provider does not decide whether an agent may call the final tool. It decides which local files may become context for a specific requester and purpose. The proxy then records that decision as provenance and attaches the same decision ids to later forwarded tool calls.

## Concepts

`ContextProvider`
: The retrieval boundary. It supplies the requester snapshot and candidate context sources.

`PermissionEvaluator`
: The policy boundary. It turns candidate sources into `selected` and `excluded` context.

`RequesterSnapshot`
: The requester identity and scopes used for the decision.

`File source group`
: A configured set of include patterns, exclude patterns, required scopes, allowed purposes, classification, and optional size limit. This is how the same workspace can expose different file classes under different policy rules.

`SelectedContext`
: Context returned to the agent. Selected context includes file content.

`ExcludedContext`
: Context withheld from the agent. Excluded context records source id, type, title, reason, and permission rule, but never file content.

## Config Shape

Set `ARI_CONTEXT_PROVIDER_CONFIG_PATH` to a JSON file:

```json
{
  "kind": "file",
  "root": ".",
  "defaultMaxBytes": 32000,
  "requesters": [
    {
      "requesterId": "samuel",
      "scopes": ["ari_repo_reader"]
    }
  ],
  "sources": [
    {
      "sourceType": "ari_repo_doc",
      "include": ["docs/**/*.md", "packages/proxy/src/**/*.ts"],
      "exclude": ["docs/private/**"],
      "requiredScopes": ["ari_repo_reader"],
      "allowedPurposes": ["ari_context_audit"],
      "classification": "internal",
      "maxBytes": 24000
    }
  ]
}
```

Relative `root` values resolve from the config file location. Include and exclude patterns must stay inside the configured root. Patterns that contain `..` path segments or start from `/` are rejected.

## Discovery Algorithm

The provider discovers files from the configured root on every context request.

```text
rootRealPath = realpath(resolve(config.root))
candidates = depth_first_walk(rootRealPath)
```

Each candidate keeps a relative path from `rootRealPath`. ARI uses that relative path for pattern matching and source ids.

```text
sourceId = "file:" + sourceType + ":" + relativePath
```

The provider uses a small path-pattern matcher with these rules:

- `*` matches inside one path segment.
- `**` matches zero or more path segments.
- `docs/` is normalized to `docs/**`.
- `./docs/**/*.md` is normalized to `docs/**/*.md`.

For each file candidate `f` and source group `g`:

```text
included(f, g) =
  exists pattern in g.include where match(pattern, f.relativePath)

configuredExcluded(f, g) =
  exists pattern in g.exclude where match(pattern, f.relativePath)

defaultExcluded(f) =
  exists pattern in ARI_DEFAULT_EXCLUDES where match(pattern, f.relativePath)
```

ARI default excludes protect obvious secret and runtime paths even when the config includes broad patterns such as `**/*`:

```text
.env
.env.*
**/.env
**/.env.*
.git/**
**/.git/**
.ari/**
**/.ari/**
node_modules/**
**/node_modules/**
dist/**
**/dist/**
build/**
**/build/**
.next/**
**/.next/**
*.db
**/*.db
*.sqlite
**/*.sqlite
```

## Safety Algorithm

Included files must pass the provider safety checks before their content can be returned.

```text
safePath(f) =
  realpath(f.absolutePath) is inside rootRealPath

safeSize(f, g) =
  f.size <= (g.maxBytes or config.defaultMaxBytes or 32000)

safeText(f) =
  first 512 bytes contain no null byte
  and control-byte ratio <= 10%

safeFile(f, g) =
  safePath(f) and safeSize(f, g) and safeText(f)
```

Symlinks are inspected by real path. A symlink that resolves outside the configured root is converted into excluded context with this rule:

```text
realpath must stay under context root
```

Oversized files and binary-looking files are also converted into excluded context. Their content is not read into selected context.

## Selection Formula

The file provider produces candidate `ContextSource` records. The shared permission evaluator then applies the same policy model used by the registry-backed provider.

For requester `r`, request purpose `p`, and source `s`:

```text
purposeAllowed(s, p) =
  s.allowedPurposes is empty
  or p is in s.allowedPurposes

scopeAllowed(s, r) =
  every scope in s.requiredScopes is in r.scopes

selected(s, r, p) =
  not s.providerExclusionReason
  and purposeAllowed(s, p)
  and scopeAllowed(s, r)
```

Everything that fails one of those checks becomes excluded context:

```text
excluded(s, r, p) =
  candidate(s)
  and not selected(s, r, p)
```

Provider exclusions run first. That means `.env`, escaped symlinks, oversized files, and binary files cannot become selected context even if the requester has broad scopes.

## Provenance Binding

When an agent calls `ari_get_context`, ARI creates:

```text
permissionSnapshotId
contextDecisionId
authorizationDecisionId
authorizationRule
```

ARI records `context.selected` and `context.excluded` events with those ids. Later forwarded tool calls carry the same ids through:

```text
tool.listed
tool.called
tool.completed
```

That gives the auditor a direct path:

```text
file policy decision -> selected/excluded context -> downstream tool call
```

## Implementation Highlights

- File content is never hardcoded in the proxy.
- Requesters, source groups, purposes, scopes, classifications, and limits live in config.
- The MCP server does not know whether context came from a JSON registry or files.
- Excluded file content is not returned to the agent.
- Default secret/runtime exclusions apply before requester-scope evaluation.
- File safety checks happen before permission selection.
- The provider uses Node filesystem APIs and local pattern matching, so the proxy does not need a new glob dependency.

## Running It

Set the provider config path:

```bash
ARI_CONTEXT_PROVIDER_CONFIG_PATH=/absolute/path/to/ari-context-provider.json
```

Start the proxy:

```bash
pnpm proxy
```

Then call `ari_get_context` from an MCP-capable agent:

```json
{
  "task": "Create an audit summary from ARI repository context.",
  "requesterId": "samuel",
  "purpose": "ari_context_audit"
}
```

The response returns selected file content and excluded summaries. The trace records both.
