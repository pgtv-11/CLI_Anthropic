# Mock FINRA Exam — WSP Walkthrough

Run annually. Simulates a FINRA Cycle Exam plus a focused topical sweep.

## Inputs

- A synthetic 8210 letter requesting:
  - 30 random recommendation events from the prior quarter, with Form CRS delivery and Reg BI evidence.
  - All wash-trading alerts in the prior 90 days, with reviewer rationale.
  - 50 random customer CIP files for new accounts opened in the prior quarter.
  - Annual CEO certification (FINRA 3130).

## Procedure

1. Examiner is provisioned per `docs/runbooks/examiner-onboarding.md`.
2. Examiner queries each item via the examiner portal; latency and audit captures are measured.
3. Avenue's compliance team produces evidence packages via `services/evidence-packager`.
4. External consultancy (Bates / Oyster / equivalent) reviews completeness against expected examiner ask.

## Pass criteria

- 100% of requested items produced within the simulated 30-day window.
- Every produced package verifies (manifest signature + SHA-256 integrity).
- Audit trail reconstructs every reviewer decision, including any LLM-assisted triage (model + prompt hash + response hash).
- Zero SoD violations in the audited reviewer assignments.

## Outputs

- A finding report stored in WORM under `mock-exam/<year>/findings.pdf` with severity-labelled gaps.
- Each finding becomes a tracked compliance issue with an SLA tied to severity.
