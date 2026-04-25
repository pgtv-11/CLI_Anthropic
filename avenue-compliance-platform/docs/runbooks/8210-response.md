# Runbook — FINRA Rule 8210 Information Request Response

**Owner:** Chief Compliance Officer (CCO)
**Trigger:** receipt of a FINRA 8210 letter or SEC subpoena.

## SLA

- **24h** — acknowledge receipt, identify in-scope custodians and matters.
- **48h** — apply legal hold across `services/comms-capture-service` and `services/records-archive-service`.
- **Per letter** — produce evidence packages by the deadline stated in the request.

## Steps

1. **Acknowledge & log.** Open a case in the compliance console; the case ID drives every downstream evidence reference.
2. **Apply legal hold.** Use `services/records-archive-service` to set `legalHold=true` on every relevant `Communication`, `RecordObject`, and `surveillance_alert`. Object Lock COMPLIANCE retention already prevents deletion; the legal hold prevents disposal at the end of normal retention.
3. **Define scope.** Custodians (CRD numbers), date range, matters/keywords. Translate to query inputs for the warehouse and OpenSearch.
4. **Generate evidence packages.** For each in-scope case: `services/evidence-packager` → PDF/A + signed manifest + items folder. Verify SHA-256 of the manifest after upload; record both in the audit log.
5. **Quality check.** A second compliance officer verifies completeness using the `tests/mock-exam` checklist. SoD bundle blocks the same officer from approving their own packages.
6. **Deliver.** Provide via FINRA Gateway or the SEC's secure portal. Capture the receipt in the audit log under action `EXPORT`.
7. **Close.** Once the matter is closed *and* the regulator confirms no further requests, file a closure note. Do **not** lift legal holds without legal sign-off.

## Common pitfalls

- Lifting legal holds early — never do this without written legal sign-off (and a second approver).
- Producing materials outside the warehouse — bypassing the gateway means no audit trail; blocked by RBAC + network egress controls.
- Translating PT-BR materials without flagging machine translation — examiners must see both the original and a `machine-translated:true` flag.
