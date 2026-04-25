import { createHmac, timingSafeEqual } from 'node:crypto';

// Examiner sessions are issued by the identity service when an external
// FINRA/SEC examiner is provisioned (see runbooks/examiner-onboarding.md).
// The watermark is an HMAC-SHA256 over the canonical session payload using
// a server-side secret. The gateway verifies the watermark BEFORE handing
// the session to OPA — OPA only ever sees a verified session, never raw
// client claims.
//
// Round 2 critique flagged that the prior implementation used a plain-text
// "EXAMINER_SESSION" string; that string is now the *prefix* of the canonical
// payload but no longer the trust anchor.

export interface ExaminerSessionClaims {
  id: string;
  expiresAt: string; // ISO-8601
  issuedAt: string;
  examinerCrd: string;
  matterId: string;
}

export interface SignedExaminerSession extends ExaminerSessionClaims {
  watermark: string; // hex HMAC
}

const WATERMARK_PREFIX = 'EXAMINER_SESSION';

function canonicalPayload(claims: ExaminerSessionClaims): string {
  // Same canonical algorithm as audit-sdk: sorted keys, no whitespace.
  const obj = {
    examinerCrd: claims.examinerCrd,
    expiresAt: claims.expiresAt,
    id: claims.id,
    issuedAt: claims.issuedAt,
    matterId: claims.matterId,
    prefix: WATERMARK_PREFIX,
  };
  return JSON.stringify(obj, Object.keys(obj).sort());
}

export function signExaminerSession(
  claims: ExaminerSessionClaims,
  secret: Buffer,
): SignedExaminerSession {
  const mac = createHmac('sha256', secret).update(canonicalPayload(claims)).digest('hex');
  return { ...claims, watermark: mac };
}

export function verifyExaminerSession(
  session: SignedExaminerSession,
  secret: Buffer,
  now: Date = new Date(),
): { valid: boolean; reason?: string } {
  if (!session.watermark || session.watermark.length !== 64) {
    return { valid: false, reason: 'watermark-missing-or-malformed' };
  }
  const expected = createHmac('sha256', secret).update(canonicalPayload(session)).digest();
  const provided = Buffer.from(session.watermark, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { valid: false, reason: 'watermark-mismatch' };
  }
  if (Date.parse(session.expiresAt) <= now.getTime()) {
    return { valid: false, reason: 'session-expired' };
  }
  return { valid: true };
}
