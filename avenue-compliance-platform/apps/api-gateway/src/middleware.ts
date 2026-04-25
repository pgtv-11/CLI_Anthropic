import { randomUUID } from 'node:crypto';
import { AuditClient } from '@avenue/audit-sdk';
import { CompositePolicyEngine, PolicyInput } from '@avenue/identity-policy-service';

// Edge middleware — every request flows through:
//   1. Authentication (Okta JWT verified upstream by load balancer)
//   2. PolicyEngine.authorize (OPA — examiner-mode → SoD → RBAC)
//   3. Audit log record (append-only, fanned to Kafka + WORM S3)
// Failure of any step yields 403 and an audit-flagged DENY event.

export interface AuthenticatedRequest {
  subject: { id: string; roles: string[]; crd?: string };
  ip: string;
  sessionId: string;
  requestId: string;
  examinerSession?: { id: string; expiresAt: string; watermark: string };
}

export interface ResourceClaim {
  kind: string;
  id: string;
  [key: string]: unknown;
}

export interface GatewayContext {
  audit: AuditClient;
  policy: CompositePolicyEngine;
  now: () => Date;
}

export async function gate<T>(
  ctx: GatewayContext,
  req: AuthenticatedRequest,
  action: string,
  resource: ResourceClaim,
  handler: () => Promise<T>,
): Promise<T> {
  const policyInput: PolicyInput = {
    subject: req.subject,
    action,
    resource,
    context: {
      now: ctx.now().toISOString(),
      requestId: req.requestId,
      ...(req.examinerSession ? { examinerSession: req.examinerSession } : {}),
    },
  };

  const decision = await ctx.policy.authorize(policyInput);

  if (!decision.allow) {
    await ctx.audit.record({
      actor: req.subject.id,
      actorRole: req.subject.roles[0] ?? 'unknown',
      actorCrd: req.subject.crd,
      action: 'REJECT',
      target: { kind: resource.kind, id: resource.id },
      requestId: req.requestId,
      sessionId: req.sessionId,
      ip: req.ip,
      outcome: 'POLICY_DENY',
      outcomeDetails: { denies: decision.denies },
    });
    const err = new Error(`forbidden: ${decision.denies.join(', ')}`);
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }

  // Two-phase audit: (1) intent recorded BEFORE the handler runs, so a
  // crashed audit sink fails-closed before any state mutation; (2) outcome
  // recorded AFTER the handler returns. The intent record carries
  // outcome=UNKNOWN; reconciliation jobs flag any UNKNOWN that has no
  // corresponding outcome record within the SLA window.
  await ctx.audit.record({
    actor: req.subject.id,
    actorRole: req.subject.roles[0] ?? 'unknown',
    actorCrd: req.subject.crd,
    action: mapAction(action),
    target: { kind: resource.kind, id: resource.id },
    requestId: req.requestId,
    sessionId: req.sessionId,
    ip: req.ip,
    outcome: 'UNKNOWN',
    outcomeDetails: { phase: 'intent' },
  });

  let outcome: 'SUCCESS' | 'HANDLER_ERROR' = 'SUCCESS';
  let handlerError: Error | undefined;
  let result: T | undefined;
  try {
    result = await handler();
  } catch (err) {
    outcome = 'HANDLER_ERROR';
    handlerError = err as Error;
  }

  try {
    await ctx.audit.record({
      actor: req.subject.id,
      actorRole: req.subject.roles[0] ?? 'unknown',
      actorCrd: req.subject.crd,
      action: mapAction(action),
      target: { kind: resource.kind, id: resource.id },
      requestId: req.requestId,
      sessionId: req.sessionId,
      ip: req.ip,
      outcome,
      outcomeDetails: handlerError
        ? { errorClass: handlerError.constructor.name, message: handlerError.message }
        : { phase: 'outcome' },
    });
  } catch (auditErr) {
    // The handler already mutated state. Surface a 5xx so the caller cannot
    // assume success; reconciliation will pair the orphaned intent record
    // with the actual mutation later. Critically: never swallow the audit
    // failure — fail loudly so on-call sees the gap.
    const fatal = new Error(
      `audit_sink_failure_after_handler: ${(auditErr as Error).message}; ` +
        `request=${req.requestId} target=${resource.kind}:${resource.id}`,
    );
    (fatal as Error & { statusCode: number }).statusCode = 500;
    throw fatal;
  }

  if (handlerError) throw handlerError;
  return result as T;
}

function mapAction(action: string): 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'APPROVE' | 'OVERRIDE' | 'ESCALATE' | 'SUBMIT_FILING' {
  if (action === 'read') return 'READ';
  if (action === 'create') return 'CREATE';
  if (action === 'update') return 'UPDATE';
  if (action === 'delete') return 'DELETE';
  if (action === 'export') return 'EXPORT';
  if (action === 'approve' || action.startsWith('approve-') || action === 'principal-approve') return 'APPROVE';
  if (action === 'override') return 'OVERRIDE';
  if (action === 'escalate') return 'ESCALATE';
  if (action === 'submit-filing') return 'SUBMIT_FILING';
  return 'READ';
}

export function newRequestId(): string {
  return randomUUID();
}
