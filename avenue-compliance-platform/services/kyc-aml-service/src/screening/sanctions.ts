import { z } from 'zod';

// Sanctions / PEP / adverse-media screening provider abstraction.
// Production wires either ComplyAdvantage or Refinitiv World-Check behind
// this interface; no caller depends on the vendor directly.

export const ScreeningHitSchema = z.object({
  hitId: z.string(),
  list: z.enum(['OFAC_SDN', 'OFAC_NON_SDN', 'EU', 'UN', 'PEP', 'ADVERSE_MEDIA']),
  matchScore: z.number().min(0).max(1),
  matchedName: z.string(),
  notes: z.string().optional(),
});
export type ScreeningHit = z.infer<typeof ScreeningHitSchema>;

export interface ScreeningQuery {
  fullName: string;
  dateOfBirth: string;
  country: string;
  taxIdLast4?: string;
}

export interface ScreeningProvider {
  screen(query: ScreeningQuery): Promise<ScreeningHit[]>;
}

export class StubScreeningProvider implements ScreeningProvider {
  async screen(_query: ScreeningQuery): Promise<ScreeningHit[]> {
    // Replaced in F2 with ComplyAdvantage or Refinitiv. Returning [] would
    // mask production bugs, so the stub is wired *off* by configuration only.
    throw new Error('ScreeningProvider stub — wire ComplyAdvantage or Refinitiv before F2 GA.');
  }
}

export const HIT_REQUIRES_EDD_THRESHOLD = 0.7;
export const HIT_BLOCKS_ONBOARDING_THRESHOLD = 0.9;
