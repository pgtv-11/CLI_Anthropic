import { z } from 'zod';

// Suspicious Activity Report (31 CFR 1010.320) — drafting, dual-approval,
// FinCEN E-File submission. The dual-approval rule lives in OPA
// (sod/policies.rego: deny_solo_sar_filing); this module merely shapes data.

export const SarStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SUBMITTED',
  'AMENDED',
  'REJECTED',
]);
export type SarStatus = z.infer<typeof SarStatusSchema>;

export const SarSchema = z.object({
  sarId: z.string().uuid(),
  customerId: z.string().uuid(),
  draftedBy: z.string(),
  draftedAt: z.string().datetime(),
  approvers: z.array(z.string()).default([]),
  approvedAt: z.string().datetime().optional(),
  submittedAt: z.string().datetime().optional(),
  status: SarStatusSchema,
  narrative: z.string().min(50),
  amountUsd: z.number().nonnegative(),
  suspectedActivities: z.array(z.string()).min(1),
  fincenAcknowledgmentId: z.string().optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
});
export type Sar = z.infer<typeof SarSchema>;

export interface FincenSubmitter {
  submit(sar: Sar): Promise<{ acknowledgmentId: string; submittedAt: string }>;
}

export class StubFincenSubmitter implements FincenSubmitter {
  async submit(_sar: Sar) {
    throw new Error('FincenSubmitter stub — wire BSA E-Filing before F2 GA.');
  }
}
