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

  await ctx.audit.record({
    actor: req.subject.id,
    actorRole: req.subject.roles[0] ?? 'unknown',
    actorCrd: req.subject.crd,
    action: decision.allow ? mapAction(action) : 'REJECT',
    target: { kind: resource.kind, id: resource.id },
    requestId: req.requestId,
    sessionId: req.sessionId,
    ip: req.ip,
    after: decision.allow ? undefined : { denies: decision.denies },
  });

  if (!decision.allow) {
    const err = new Error(`forbidden: ${decision.denies.join(', ')}`);
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
  return handler();
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
