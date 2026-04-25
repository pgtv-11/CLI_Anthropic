# Runbook — Legal Hold

**Trigger:** litigation, regulatory inquiry (FINRA 8210, SEC subpoena), internal investigation.
**Authority to apply:** General Counsel + CCO (dual approval).
**Authority to release:** General Counsel + CCO (dual approval) **and** matter closure confirmation.

## Apply

1. Open a `legal_hold` record in `records-archive-service` with: matter ID, custodians (CRD numbers), date range, scope (channels, accounts, products).
2. The hold cascades to: `Communication`, `RecordObject`, `surveillance_alert`, `recommendation_event`, `sar`. Each impacted record gets `legalHoldIds += [matterId]`.
3. S3 Object Lock LegalHold flag is set on the underlying objects to block disposal even after Object Lock retention expiry.
4. Notify all custodians via standard hold-notice template (FINRA recordkeeping rules require acknowledgment).
5. Quarterly while open: re-issue the notice and capture acknowledgments.

## Release

- All matters dependent on the hold are closed.
- Dual-approval action `RELEASE_LEGAL_HOLD` recorded in audit log.
- The `legalHoldIds` list is *appended to*, not replaced — historical traceability matters.

## Failure modes (do not do)

- Do **not** delete records under hold. Object Lock will reject the request and audit-log will record the attempt as a `DENY` with reason `legal-hold-prevents-disposal`.
- Do **not** edit communications under hold. The records-archive service does not expose a mutate endpoint; any attempt via S3 directly is blocked by Object Lock COMPLIANCE.
- Do **not** rely on memory — the `legal_hold` record is the canonical state.
