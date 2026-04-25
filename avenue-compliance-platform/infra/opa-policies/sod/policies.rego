# Segregation of Duties (SoD) — pillar P3.
#
# Input shape:
#   {
#     "subject":  { "id": "...", "roles": ["..."], "crd": "..." },
#     "action":   "approve|review|create|...",
#     "resource": { "kind": "alert|sar|recommendation|...", "id": "...", "createdBy": "...", "reviewers": ["..."] },
#     "context":  { "now": "ISO8601", "requestId": "..." }
#   }
#
# Decisions are deny-by-default. `allow` requires positive evidence.

package avenue.sod

import rego.v1

default allow := false

# ---------------------------------------------------------------------------
# 1. The four-eyes rule: a creator/maker cannot also approve their own work.
# ---------------------------------------------------------------------------

deny_self_approval if {
	input.action in {"approve", "close-no-action", "submit-filing"}
	input.resource.createdBy == input.subject.id
}

deny_self_approval if {
	input.action in {"approve", "close-no-action", "submit-filing"}
	some reviewer in object.get(input.resource, "reviewers", [])
	reviewer == input.subject.id
}

# ---------------------------------------------------------------------------
# 2. Surveillance: L1 reviewer cannot approve their own escalation as L2.
# ---------------------------------------------------------------------------

deny_l1_acting_as_l2 if {
	input.resource.kind == "surveillance_alert"
	input.action == "approve-l2"
	some r in object.get(input.resource, "l1Reviewers", [])
	r == input.subject.id
}

# ---------------------------------------------------------------------------
# 3. Reg BI: a registered representative cannot approve their own
#    recommendation; a supervisor approving must not also be in the rep's
#    direct chain of compensation.
# ---------------------------------------------------------------------------

deny_self_recommendation_approval if {
	input.resource.kind == "recommendation_event"
	input.action == "approve"
	input.resource.repId == input.subject.id
}

deny_compensation_conflict if {
	input.resource.kind == "recommendation_event"
	input.action == "approve"
	some link in object.get(input.subject, "compensationLinks", [])
	link == input.resource.repId
}

# ---------------------------------------------------------------------------
# 4. AML/SAR: drafter cannot file alone — requires a second compliance officer.
# ---------------------------------------------------------------------------

deny_solo_sar_filing if {
	input.resource.kind == "sar"
	input.action == "submit-filing"
	count(object.get(input.resource, "approvers", [])) < 2
}

deny_solo_sar_filing if {
	input.resource.kind == "sar"
	input.action == "submit-filing"
	some a in object.get(input.resource, "approvers", [])
	a == input.resource.draftedBy
}

# ---------------------------------------------------------------------------
# 5. Comms review: producer of a piece of marketing cannot approve it
#    (FINRA 2210 principal review must be independent).
# ---------------------------------------------------------------------------

deny_marketing_self_review if {
	input.resource.kind == "marketing_piece"
	input.action == "principal-approve"
	input.resource.createdBy == input.subject.id
}

# ---------------------------------------------------------------------------
# Aggregate denies + allow
# ---------------------------------------------------------------------------

denies contains "self-approval-forbidden" if deny_self_approval
denies contains "l1-cannot-act-as-l2" if deny_l1_acting_as_l2
denies contains "rep-cannot-approve-own-recommendation" if deny_self_recommendation_approval
denies contains "compensation-chain-conflict" if deny_compensation_conflict
denies contains "sar-requires-two-distinct-approvers" if deny_solo_sar_filing
denies contains "marketing-principal-review-must-be-independent" if deny_marketing_self_review

allow if {
	count(denies) == 0
	rbac_allows
}

# Bridge to RBAC bundle.
rbac_allows if {
	data.avenue.rbac.allow
}
