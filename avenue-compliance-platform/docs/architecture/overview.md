# Architecture Overview

This document is the entry point for engineers, security reviewers, and external examiners. It is intentionally short — every claim links to the file or test that backs it.

## Pillars (P1–P7)

| Pillar | Where it lives |
|--------|----------------|
| P1 — Immutable Audit Log (hash-chain) | `packages/audit-sdk` (TS) + `packages/audit-sdk-py` (Py); fanned to Kafka and S3 Object Lock via `services/audit-log-service` |
| P2 — WORM Archive 17a-4(f) | `infra/terraform/s3-object-lock` (Compliance mode, ≥7 yr retention, cross-region replica) |
| P3 — RBAC + Segregation of Duties | `infra/opa-policies/{sod,rbac,examiner-mode}` enforced through `services/identity-policy-service` |
| P4 — Examiner Mode | `apps/web-examiner-portal` + `infra/opa-policies/examiner-mode` |
| P5 — Evidence Package Export | `services/evidence-packager` |
| P6 — Regulatory Knowledge (Claude) | `services/regulatory-rag-service` (Sonnet for reasoning, Haiku for triage), citation guarded |
| P7 — Data Lineage & Reproducibility | bitemporal records + `rule_version_id` carried through every domain entity |

## Modules (M1–M4)

| Module | Service(s) | Reg foundation |
|--------|------------|---------------|
| M1 KYC / AML / CIP | `services/kyc-aml-service` | 31 CFR 1023.220, FINRA 3310, BSA, OFAC |
| M2 Suitability / Reg BI | `services/suitability-regbi-service` | SEC 17 CFR 240.15l-1, FINRA 2111, Form CRS |
| M3 Trade Surveillance | `services/surveillance-engine` | FINRA 5210, 3110, MNPI |
| M4 Books & Records + Comms | `services/comms-capture-service` + `services/records-archive-service` | SEC 17a-3/-4, FINRA 4511, 2210, 3110.06–.09 |

## Request flow (golden path)

```
User (Okta SSO) → CloudFront → API Gateway (apps/api-gateway/src/middleware.ts)
                                       │
                                       ├── PolicyEngine.authorize  (services/identity-policy-service)
                                       │       OPA bundles: examiner-mode → sod → rbac
                                       │
                                       ├── audit.record  (packages/audit-sdk → Kafka + S3 Object Lock)
                                       │
                                       └── domain handler (M1/M2/M3/M4)
```

A failure at any step yields a 403 + a `REJECT` audit event. There is no path that bypasses the gate.

## Reproducibility

Every regulatory decision is reconstructible bit-for-bit years later because:

1. Inputs are versioned (`rule_version_id`, `scenario_version`, bundle effective dates).
2. Outputs carry the same identifiers.
3. The audit chain proves nothing was altered after the fact.
4. Snowflake Time Travel / Fail-safe lets analysts replay the warehouse state on the date of the decision.

## Where to look first

- `docs/regulatory-mapping/controls-matrix.yaml` — single source of truth for rule → control → file → test.
- `services/regulatory-rag-service/src/rag.py` — how Claude is allowed to assist (and what it is forbidden to do).
- `infra/opa-policies/sod/policies.rego` — how four-eyes and SoD are enforced.
- `services/surveillance-engine/scenarios/wash_trading.py` — reference implementation of a surveillance scenario.
