package ari.demo

import rego.v1

default decision := {
	"allow": false,
	"reason": "The action does not match the demo policy.",
	"policyId": "ari.demo.default_deny",
	"policyVersion": "1",
}

decision := {
	"allow": true,
	"reason": "Issue creation is allowed for the selected demo ticket and configured test repository.",
	"policyId": "ari.demo.create_test_issue",
	"policyVersion": "1",
} if {
	input.upstream.id == "github-demo"
	input.upstream.type == "github"
	input.action.name == "issue_write"
	input.action.arguments.method == "create"
	input.action.arguments.owner == data.demo.github.owner
	input.action.arguments.repo == data.demo.github.repo
	some source in input.context.selected
	source.sourceId == "ticket:checkout-demo"
}
