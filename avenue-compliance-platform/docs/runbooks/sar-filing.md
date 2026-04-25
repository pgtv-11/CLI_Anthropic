# Runbook — Suspicious Activity Report (SAR) Filing

**Reg basis:** 31 CFR 1010.320, FINRA 3310.
**Owner:** designated AML Officer; CCO escalation.

## Decision criteria (concise)

File a SAR when the firm "knows, suspects, or has reason to suspect" a transaction:

- Involves funds derived from illegal activity, or
- Is designed to evade BSA reporting, or
- Has no apparent business or lawful purpose, or
- Involves use of the firm to facilitate criminal activity.

## Workflow

1. **Triggering signal.** Surveillance alert, transaction-monitoring rule, or analyst escalation lands in the SAR queue. Open a SAR draft (`services/kyc-aml-service/src/sar`).
2. **Investigate.** Pull `Customer`, `account`, transaction, and prior-SAR history from the warehouse. Note: this read is audited under action `READ` with target `customer:<id>`.
3. **Draft the narrative.** Use the SAR narrative template; cite specific transactions, amounts, dates, and counterparties.
4. **First approval.** AML Officer reviews. SoD bundle blocks self-approval (`deny_solo_sar_filing`).
5. **Second approval.** A second compliance officer (distinct from drafter and from first approver) approves. **Two distinct approvers are mandatory** — enforced in OPA.
6. **Submit.** `services/kyc-aml-service/src/sar` calls `FincenSubmitter.submit`. The acknowledgment ID is recorded with action `SUBMIT_FILING` in the audit log.
7. **Archive.** Submission acknowledgment, narrative, and supporting items are bundled by `services/evidence-packager` and written to the comms-archive WORM bucket.
8. **30/90/180-day review.** If the activity continues, file a continuing SAR. The case stays open until either resolution or the regulator closes it.

## Confidentiality

- SAR existence is **never** disclosed to the customer or external parties (12 CFR 21.11). Audit log queries about SARs require examiner role and cite a specific session ID.
- Supplemental Information (Form 90-22.47 / 314(b) sharing) is logged separately.

## Continuous improvement

- Monthly: backtest transaction-monitoring rules against filed SARs (recall ≥ 95% on material cases).
- Quarterly: independent test of the AML program (FINRA 3310(c)).
