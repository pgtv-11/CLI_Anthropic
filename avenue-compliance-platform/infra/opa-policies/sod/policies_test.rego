package avenue.sod_test

import data.avenue.sod
import rego.v1

base_subject := {"id": "alice", "roles": ["compliance_officer"], "crd": "1234567"}

test_self_approval_denied if {
	input := {
		"subject": base_subject,
		"action": "approve",
		"resource": {"kind": "surveillance_alert", "id": "A-1", "createdBy": "alice"},
	}
	"self-approval-forbidden" in sod.denies with input as input
}

test_distinct_approver_allowed_through_sod if {
	input := {
		"subject": {"id": "bob", "roles": ["supervisor"], "crd": "7654321"},
		"action": "approve",
		"resource": {"kind": "surveillance_alert", "id": "A-1", "createdBy": "alice", "reviewers": ["alice"]},
	}
	count(sod.denies) == 0 with input as input
}

test_solo_sar_filing_denied if {
	input := {
		"subject": base_subject,
		"action": "submit-filing",
		"resource": {"kind": "sar", "id": "SAR-1", "draftedBy": "alice", "approvers": ["alice"]},
	}
	"sar-requires-two-distinct-approvers" in sod.denies with input as input
}

test_two_distinct_sar_approvers_pass if {
	input := {
		"subject": {"id": "carol", "roles": ["compliance_officer"], "crd": "1111111"},
		"action": "submit-filing",
		"resource": {"kind": "sar", "id": "SAR-1", "draftedBy": "alice", "approvers": ["bob", "carol"]},
	}
	not "sar-requires-two-distinct-approvers" in sod.denies with input as input
}

# Defends against the "same user wearing two hats" loophole: even with two
# entries in the approvers list, if they're the same person, deny.
test_duplicate_approver_id_denied if {
	input := {
		"subject": {"id": "bob", "roles": ["chief_compliance_officer"], "crd": "7654321"},
		"action": "submit-filing",
		"resource": {"kind": "sar", "id": "SAR-1", "draftedBy": "alice", "approvers": ["bob", "bob"]},
	}
	"sar-requires-two-distinct-approvers" in sod.denies with input as input
}

test_rep_cannot_approve_own_recommendation if {
	input := {
		"subject": {"id": "rep1", "roles": ["registered_rep"], "crd": "9000001"},
		"action": "approve",
		"resource": {"kind": "recommendation_event", "id": "R-1", "repId": "rep1"},
	}
	"rep-cannot-approve-own-recommendation" in sod.denies with input as input
}
