# Examiner Mode (P4): every external examiner action is read-only and audited.
# This bundle is enforced *in addition* to RBAC + SoD.

package avenue.examiner

import rego.v1

default allow := false

# Read-only actions permitted in examiner mode.
read_only_actions := {"read", "export"}

allow if {
	"examiner_external" in input.subject.roles
	input.action in read_only_actions
	input.context.examinerSession.id != ""
	input.context.examinerSession.watermark == "EXAMINER_SESSION"
}

# Mutating actions in examiner mode are explicitly denied — defence in depth.
deny contains "mutation-denied-in-examiner-mode" if {
	"examiner_external" in input.subject.roles
	not input.action in read_only_actions
}

# Examiner sessions must have an expiry — stale sessions are denied.
deny contains "examiner-session-expired" if {
	"examiner_external" in input.subject.roles
	expires := time.parse_rfc3339_ns(input.context.examinerSession.expiresAt)
	now := time.parse_rfc3339_ns(input.context.now)
	now > expires
}
