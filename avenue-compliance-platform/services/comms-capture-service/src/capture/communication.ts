import { z } from 'zod';

// Captured communication record (FINRA 4511, FINRA 3110.06-.09).
// Source connectors (Smarsh / Global Relay / Microsoft Purview / call-recording)
// land normalized records here; downstream review and WORM archival follow.

export const CommunicationChannelSchema = z.enum([
  'EMAIL',
  'SMS',
  'WHATSAPP_BUSINESS',
  'TEAMS',
  'SLACK',
  'VOICE',
  'SOCIAL_PUBLIC',
]);

export const CommunicationSchema = z.object({
  commId: z.string().uuid(),
  channel: CommunicationChannelSchema,
  externalId: z.string().min(1),
  capturedAt: z.string().datetime(),
  occurredAt: z.string().datetime(),
  participants: z.array(z.string()).min(1),
  internalParticipants: z.array(z.string()).default([]),
  subject: z.string().optional(),
  bodySha256: z.string().regex(/^[0-9a-f]{64}$/),
  language: z.enum(['en', 'pt-BR', 'es', 'unknown']).default('unknown'),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        contentType: z.string(),
      }),
    )
    .default([]),
  retentionPolicyId: z.string(),
  legalHoldIds: z.array(z.string()).default([]),
});
export type Communication = z.infer<typeof CommunicationSchema>;
