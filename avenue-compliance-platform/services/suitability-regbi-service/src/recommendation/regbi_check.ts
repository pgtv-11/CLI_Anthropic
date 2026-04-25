import { z } from 'zod';
import { InvestmentProfile } from '../profile/profile.js';

// Reg BI pre-trade check — SEC 17 CFR 240.15l-1.
// The four obligations (Care, Disclosure, Conflict, Compliance) are evaluated
// before a registered representative may transmit a recommendation. This
// function returns a deterministic "go / no-go" with the cited rationale —
// the *human* registered rep is still the decider.

export const RecommendationKindSchema = z.enum([
  'BUY',
  'SELL',
  'HOLD',
  'ROLLOVER',
  'ACCOUNT_TYPE_CHANGE',
]);

export const ProductRiskTierSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'COMPLEX']);

export interface ProductSnapshot {
  productId: string;
  symbol: string;
  riskTier: z.infer<typeof ProductRiskTierSchema>;
  totalCostBps: number;
  liquidityScore: number; // 0..1
  isComplex: boolean;
  alternativesConsidered: { productId: string; totalCostBps: number; rationale: string }[];
}

export interface RegBIInput {
  profile: InvestmentProfile;
  recommendationKind: z.infer<typeof RecommendationKindSchema>;
  product: ProductSnapshot;
  formCrsLastDeliveredAt?: string;
  conflicts: { kind: string; disclosure: string }[];
  ruleVersionId: string;
}

export interface RegBIResult {
  decision: 'PROCEED' | 'BLOCK' | 'REQUIRES_OVERRIDE';
  reasons: string[];
  citations: string[];
  ruleVersionId: string;
}

const RISK_INCOMPATIBILITY: Record<string, ReadonlyArray<string>> = {
  CONSERVATIVE: ['HIGH', 'COMPLEX'],
  MODERATE: ['COMPLEX'],
  AGGRESSIVE: [],
};

export function evaluateRegBI(input: RegBIInput): RegBIResult {
  const reasons: string[] = [];
  const citations: string[] = ['SEC 17 CFR 240.15l-1'];

  // Care Obligation — risk match.
  const incompatible = RISK_INCOMPATIBILITY[input.profile.riskTolerance] ?? [];
  if (incompatible.includes(input.product.riskTier)) {
    reasons.push(
      `Care: product risk ${input.product.riskTier} incompatible with ` +
        `profile tolerance ${input.profile.riskTolerance}`,
    );
  }

  // Care Obligation — alternatives reasonably considered.
  if (input.product.alternativesConsidered.length === 0) {
    reasons.push('Care: no alternatives considered');
  } else {
    const cheapest = Math.min(
      ...input.product.alternativesConsidered.map((a) => a.totalCostBps),
    );
    if (input.product.totalCostBps > cheapest * 1.5) {
      reasons.push(
        `Care: chosen product cost ${input.product.totalCostBps}bps materially exceeds ` +
          `cheapest considered alternative (${cheapest}bps)`,
      );
    }
  }

  // Disclosure Obligation — Form CRS delivery.
  if (!input.formCrsLastDeliveredAt) {
    reasons.push('Disclosure: Form CRS has not been delivered to this customer');
  }

  // Conflict Obligation — material conflicts must be disclosed.
  for (const c of input.conflicts) {
    if (!c.disclosure || c.disclosure.length < 20) {
      reasons.push(`Conflict: insufficient disclosure for ${c.kind}`);
    }
  }

  // Complex products require override.
  if (input.product.isComplex && input.profile.investmentExperience === 'NONE') {
    return {
      decision: 'REQUIRES_OVERRIDE',
      reasons: [
        ...reasons,
        'Care: complex product recommended to customer with no investment experience',
      ],
      citations,
      ruleVersionId: input.ruleVersionId,
    };
  }

  return {
    decision: reasons.length === 0 ? 'PROCEED' : 'BLOCK',
    reasons,
    citations,
    ruleVersionId: input.ruleVersionId,
  };
}
