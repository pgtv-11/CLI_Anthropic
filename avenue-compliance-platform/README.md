# Avenue Compliance Platform

Plataforma interna de compliance regulatório para a **Avenue Securities LLC** — broker-dealer registrado na SEC e na FINRA, de capital brasileiro, oferecendo acesso ao mercado americano a investidores brasileiros de varejo.

> **Status:** scaffold em desenvolvimento. Ver `/root/.claude/plans/` para o roadmap completo.

## Pilares (P1–P7)

1. **Immutable Audit Log** — hash-chain append-only (`packages/audit-sdk`)
2. **WORM Archive 17a-4(f)** — S3 Object Lock Compliance (`infra/terraform/s3-object-lock`)
3. **RBAC + SoD** — OPA policies (`infra/opa-policies`)
4. **Examiner Mode** — réplica read-only watermarcada (`apps/web-examiner-portal`)
5. **Evidence Package Export** — PDF/A determinístico assinado (`services/evidence-packager`)
6. **Regulatory Knowledge (Claude)** — RAG sobre rulebook (`services/regulatory-rag-service`)
7. **Data Lineage & Reproducibility** — bitemporal + `rule_version_id`

## Módulos regulatórios

- **M1 KYC/AML/CIP** — `services/kyc-aml-service`
- **M2 Suitability/Reg BI** — `services/suitability-regbi-service`
- **M3 Trade Surveillance** — `services/surveillance-engine`
- **M4 Books & Records + Comms** — `services/comms-capture-service` + `services/records-archive-service`

## Stack

AWS · EKS · MSK Kafka · Aurora Postgres · Snowflake · S3 Object Lock · NestJS (TS) · FastAPI (Python) · Next.js · OpenSearch k-NN · Okta · OPA · **Claude API** (Sonnet 4.5 + Haiku 4.5)

## Layout

```
apps/        — Next.js consoles + API gateway
services/    — microsserviços de domínio
packages/    — libs compartilhadas (audit-sdk, types, rule-engine)
infra/       — Terraform + OPA + Helm
data/        — corpora versionados (rulebook, scenarios, retention)
docs/        — arquitetura + regulatory-mapping + runbooks
tests/       — mock-exam, retention-tests, surveillance-backtest
```

## Documento dirigente

`docs/regulatory-mapping/controls-matrix.yaml` — matriz **regra FINRA/SEC → controle → serviço/arquivo**. É o primeiro documento que examinadores pedem; nenhum PR deve ser merged sem atualizar esta matriz quando aplicável.
