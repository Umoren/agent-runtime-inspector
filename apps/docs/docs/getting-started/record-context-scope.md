# Record context scope

ARI's current MCP path starts with an explicit context-scope record. The agent tells ARI which context entered the run, which context was withheld, and which authorization rule permits later tool calls.

Call `ari_record_context_scope` before any forwarded Merge Agent Handler tool:

```json
{
  "title": "Create issue from allowed project context",
  "authorizationRule": "selected_project_context_allows_issue_creation",
  "selected": [
    {
      "sourceId": "project-docs",
      "sourceType": "project_doc",
      "title": "Public project docs",
      "reason": "Needed to prepare the issue body.",
      "permissionRule": "project_read"
    }
  ],
  "excluded": [
    {
      "sourceId": "local-env",
      "sourceType": "secret_file",
      "title": ".env",
      "reason": "Credential material must not enter the tool call context.",
      "permissionRule": "no_secret_material"
    }
  ]
}
```

ARI generates decision identifiers when they are not supplied. Later `tool.listed`, `tool.called`, and `tool.completed` events inherit the same provenance IDs so the dashboard can show which permission boundary justified the action.
