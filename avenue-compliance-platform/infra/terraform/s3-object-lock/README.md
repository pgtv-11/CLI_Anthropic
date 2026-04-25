# S3 Object Lock — WORM module

Materializa o pilar **P2 (WORM Archive)** e o controle **SEC Rule 17a-4(f)**.

## Uso

```hcl
module "audit_worm" {
  source            = "../s3-object-lock"
  bucket_name       = "avenue-worm-audit-log-prod"
  domain            = "audit-log"
  environment       = "prod"
  access_log_bucket = aws_s3_bucket.access_logs.id
}
```

## Decisões deliberadas

- **Modo COMPLIANCE (não GOVERNANCE)** — GOVERNANCE permite usuários privilegiados encurtarem retenção, o que invalida a representação non-rewriteable/non-erasable de 17a-4(f).
- **`prevent_destroy = true`** — protege contra `terraform destroy` acidental.
- **Replicação cross-region** com Object Lock também na réplica — exigência de continuidade operacional para exames.
- **CMK por bucket** — separação de chaves por domínio compliance facilita rotação e access reviews.

## Mock 17a-4 retention test

Ver `tests/retention-tests/` — tentativa programática de override deve falhar e gerar evento de auditoria.
