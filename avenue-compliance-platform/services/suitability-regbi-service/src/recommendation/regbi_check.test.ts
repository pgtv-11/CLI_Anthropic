import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRegBI } from './regbi_check.js';
import type { InvestmentProfile } from '../profile/profile.js';

const baseProfile: InvestmentProfile = {
  profileId: '00000000-0000-4000-8000-000000000001',
  customerId: '00000000-0000-4000-8000-000000000002',
  capturedBy: 'rep1',
  capturedAt: '2026-01-01T00:00:00.000Z',
  signedByCustomerAt: '2026-01-01T00:00:00.000Z',
  objectives: ['INCOME'],
  riskTolerance: 'CONSERVATIVE',
  timeHorizon: 'MEDIUM',
  liquidityNeeds: 'MEDIUM',
  netWorthBucket: '100K_500K',
  annualIncomeBucket: '50K_150K',
  investmentExperience: 'LIMITED',
  restrictions: [],
  effectiveFrom: '2026-01-01T00:00:00.000Z',
};

test('blocks high-risk product for conservative profile', () => {
  const result = evaluateRegBI({
    profile: baseProfile,
    recommendationKind: 'BUY',
    product: {
      productId: 'P1',
      symbol: 'XYZ',
      riskTier: 'HIGH',
      totalCostBps: 100,
      liquidityScore: 0.5,
      isComplex: false,
      alternativesConsidered: [{ productId: 'P2', totalCostBps: 100, rationale: 'cheaper' }],
    },
    formCrsLastDeliveredAt: '2026-01-01T00:00:00.000Z',
    conflicts: [],
    ruleVersionId: 'regbi-2026-q2',
  });
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasons.some((r) => r.includes('Care: product risk HIGH')));
});

test('blocks when Form CRS not yet delivered', () => {
  const result = evaluateRegBI({
    profile: { ...baseProfile, riskTolerance: 'AGGRESSIVE' },
    recommendationKind: 'BUY',
    product: {
      productId: 'P1',
      symbol: 'XYZ',
      riskTier: 'MEDIUM',
      totalCostBps: 100,
      liquidityScore: 0.5,
      isComplex: false,
      alternativesConsidered: [{ productId: 'P2', totalCostBps: 90, rationale: '' }],
    },
    conflicts: [],
    ruleVersionId: 'regbi-2026-q2',
  });
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasons.some((r) => r.includes('Form CRS')));
});

test('proceeds for aligned profile with disclosed conflicts', () => {
  const result = evaluateRegBI({
    profile: { ...baseProfile, riskTolerance: 'AGGRESSIVE', investmentExperience: 'GOOD' },
    recommendationKind: 'BUY',
    product: {
      productId: 'P1',
      symbol: 'XYZ',
      riskTier: 'HIGH',
      totalCostBps: 100,
      liquidityScore: 0.5,
      isComplex: false,
      alternativesConsidered: [{ productId: 'P2', totalCostBps: 95, rationale: '' }],
    },
    formCrsLastDeliveredAt: '2026-01-01T00:00:00.000Z',
    conflicts: [
      { kind: 'rep-compensation', disclosure: 'Rep receives 0.5% trail commission disclosed in Form CRS' },
    ],
    ruleVersionId: 'regbi-2026-q2',
  });
  assert.equal(result.decision, 'PROCEED');
});
