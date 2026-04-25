# Runbook — Examiner Onboarding

**Audience:** FINRA / SEC examination staff and external auditors granted read-only access via `apps/web-examiner-portal`.
**Reg basis:** FINRA 8210, SEC examination authority.

## Provisioning

1. CCO + Identity admin (dual approval) create an examiner identity in Okta, group `examiner_external`.
2. The Okta SSO assertion produces a session containing `roles: ["examiner_external"]` and an `examinerSession` payload (`id`, `expiresAt` ≤ engagement end, `issuedAt`, `examinerCrd`, `matterId`). The identity service signs the payload with an HMAC-SHA256 over the canonical (sorted-key) JSON using a server-side secret stored in AWS Secrets Manager. The `watermark` field is the resulting hex MAC.
3. The API gateway calls `verifyExaminerSession()` *before* every request reaches OPA — OPA never sees a raw client claim. A forged or mutated session is rejected with `watermark-mismatch`; an expired session is rejected with `session-expired`.
4. RBAC bundle grants the `examiner_external` role only `read` and `export` on the resource kinds listed in `infra/opa-policies/rbac/policies.rego`.
5. Examiner-mode bundle (`infra/opa-policies/examiner-mode/policies.rego`) explicitly denies any mutating action and verifies session non-expiry on every request.

## During engagement

- Every query is recorded with `action: EXAMINER_QUERY` in the audit log.
- The portal carries a permanent banner: `EXAMINER SESSION — READ ONLY — ALL QUERIES ARE AUDITED`.
- Evidence package downloads use signed, time-limited S3 URLs; the export action is logged separately.
- Examiners may not be granted any role beyond `examiner_external`. Identity engineering blocks privileged roles via OPA.

## Off-boarding

- Session expiry is hard — even with a valid token, a request after `examinerSession.expiresAt` is denied (`examiner-session-expired`).
- Identity admin removes the user from the Okta group within 1h of engagement closure.
- A close-out report (auto-generated) lists every audited examiner action and is filed in the matter folder.

## Examiner experience guardrails

- PT-BR communications surface with both the original text and a clearly tagged machine translation.
- Snowflake reads are routed to a read-only replica sized for examiner workloads.
- The portal exposes evidence-package downloads — never raw data exports.
