# Role-Based Access Control bundle. Coarse role → action permissions.
# Pairs with `data.avenue.sod` for the SoD overlay.

package avenue.rbac

import rego.v1

default allow := false

role_grants := {
	"compliance_officer": {
		"surveillance_alert": {"read", "review", "escalate", "approve"},
		"sar": {"create", "read", "update", "submit-filing"},
		"recommendation_event": {"read", "review"},
		"customer": {"read", "update", "approve-edd"},
		"communication": {"read", "review", "flag"},
		"marketing_piece": {"read", "principal-approve"},
		"evidence_package": {"read", "create", "export"},
	},
	"chief_compliance_officer": {
		"surveillance_alert": {"read", "review", "escalate", "approve", "approve-l2", "close-no-action"},
		"sar": {"read", "submit-filing", "approve"},
		"recommendation_event": {"read", "review", "approve"},
		"customer": {"read", "update", "approve-edd"},
		"communication": {"read", "review", "flag"},
		"marketing_piece": {"read", "principal-approve"},
		"evidence_package": {"read", "create", "export"},
		"firm_certification": {"read", "sign"},
	},
	"supervisor": {
		"surveillance_alert": {"read", "review", "escalate"},
		"recommendation_event": {"read", "review", "approve"},
		"communication": {"read", "review", "flag"},
		"marketing_piece": {"read", "principal-approve"},
	},
	"registered_rep": {
		"customer": {"read"},
		"recommendation_event": {"create", "read"},
		"communication": {"create", "read"},
	},
	"examiner_external": {
		"surveillance_alert": {"read"},
		"sar": {"read"},
		"recommendation_event": {"read"},
		"customer": {"read"},
		"communication": {"read"},
		"evidence_package": {"read", "export"},
		"audit_event": {"read"},
		"firm_certification": {"read"},
	},
	"auditor_internal": {
		"surveillance_alert": {"read"},
		"sar": {"read"},
		"recommendation_event": {"read"},
		"customer": {"read"},
		"communication": {"read"},
		"evidence_package": {"read"},
		"audit_event": {"read"},
	},
}

allow if {
	some role in input.subject.roles
	allowed := role_grants[role][input.resource.kind]
	input.action in allowed
}
