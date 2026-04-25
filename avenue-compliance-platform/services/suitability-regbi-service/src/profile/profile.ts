import { z } from 'zod';

// Investor profile — captured at onboarding, re-captured on material change,
// and at minimum every 36 months (FINRA 2111 / Reg BI Care).

export const InvestmentObjectiveSchema = z.enum([
  'CAPITAL_PRESERVATION',
  'INCOME',
  'GROWTH',
  'AGGRESSIVE_GROWTH',
  'SPECULATION',
]);

export const RiskToleranceSchema = z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']);

export const TimeHorizonSchema = z.enum(['SHORT', 'MEDIUM', 'LONG']);

export const InvestmentProfileSchema = z.object({
  profileId: z.string().uuid(),
  customerId: z.string().uuid(),
  capturedBy: z.string(),
  capturedAt: z.string().datetime(),
  signedByCustomerAt: z.string().datetime(),
  objectives: z.array(InvestmentObjectiveSchema).min(1),
  riskTolerance: RiskToleranceSchema,
  timeHorizon: TimeHorizonSchema,
  liquidityNeeds: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  netWorthBucket: z.enum(['LT_100K', '100K_500K', '500K_1M', '1M_5M', 'GT_5M']),
  annualIncomeBucket: z.enum(['LT_50K', '50K_150K', '150K_500K', 'GT_500K']),
  investmentExperience: z.enum(['NONE', 'LIMITED', 'GOOD', 'EXTENSIVE']),
  restrictions: z.array(z.string()).default([]),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
});
export type InvestmentProfile = z.infer<typeof InvestmentProfileSchema>;
