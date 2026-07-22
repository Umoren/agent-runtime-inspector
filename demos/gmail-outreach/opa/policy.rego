package ari.gateway

import rego.v1

default result := {
  "allow": false,
  "reason": "No enabled workflow policy matches this action.",
  "policyId": "ari.default_deny"
}

result := {
  "allow": true,
  "reason": "The configured outreach workflow permits this draft for its approved recipient list.",
  "policyId": workflow.policy_id,
  "policyVersion": workflow.policy_version
} if {
  workflow := data.ari.workflows[input.purpose]
  workflow.enabled
  input.principal.id == workflow.principal_id
  input.upstream == workflow.upstream
  input.action.name == workflow.action.name
  input.action.arguments.to == workflow.action.recipients
  object.get(input.action.arguments, "cc", []) == []
  object.get(input.action.arguments, "bcc", []) == []
  not input.action.arguments.htmlBody
  not input.action.arguments.replyToMessageId
  count(object.get(input.action.arguments, "body", "")) <= workflow.action.max_body_characters
  required_context_present(input.context.selected, workflow.required_context_source_types)
}

required_context_present(selected, required) if {
  selected_source_types := {item.sourceType | item := selected[_]}
  every source_type in required {
    source_type in selected_source_types
  }
}
