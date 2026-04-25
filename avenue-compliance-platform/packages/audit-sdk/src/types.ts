import { z } from 'zod';

export const AuditActionSchema = z.enum([
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'EXPORT',
  'APPROVE',
  'REJECT',
  'OVERRIDE',
  'ESCALATE',
  'SUBMIT_FILING',
  'EXAMINER_QUERY',
  'LLM_ASSIST',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEventInputSchema = z.object({
  actor: z.string().min(1),
  actorRole: z.string().min(1),
  actorCrd: z.string().regex(/^\d{1,8}$/).optional(),
  action: AuditActionSchema,
  target: z.object({
    kind: z.string().min(1),
    id: z.string().min(1),
  }),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  requestId: z.string().uuid(),
  sessionId: z.string().uuid(),
  ip: z.string().min(1),
  userAgent: z.string().optional(),
  ruleVersionId: z.string().optional(),
  llmContext: z
    .object({
      model: z.string(),
      promptHash: z.string(),
      responseHash: z.string(),
    })
    .optional(),
});
export type AuditEventInput = z.infer<typeof AuditEventInputSchema>;

export interface AuditEvent {
  eventId: string;
  ts: string;
  actor: string;
  actorRole: string;
  actorCrd: string | undefined;
  action: AuditAction;
  target: { kind: string; id: string };
  beforeHash: string | undefined;
  afterHash: string | undefined;
  requestId: string;
  sessionId: string;
  ip: string;
  userAgent: string | undefined;
  ruleVersionId: string | undefined;
  llmContext: { model: string; promptHash: string; responseHash: string } | undefined;
  prevChainHash: string;
  chainHash: string;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}
