import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRegBI } from './handler.js';
import type { InvestmentProfile } from '../profile/profile.js';

const profile: InvestmentProfile = {
  profileId: '00000000-0000-4000-8000-000000000001',
  customerId: '00000000-0000-4000-8000-000000000002',
  capturedBy: 'rep1',
  capturedAt: '2026-01-01T00:00:00.000Z',
  signedByCustomerAt: '2026-01-01T00:00:00.000Z',
  objectives: ['INCOME'],
  riskTolerance: 'AGGRESSIVE',
  timeHorizon: 'MEDIUM',
  liquidityNeeds: 'MEDIUM',
  netWorthBucket: '100K_500K',
  annualIncomeBucket: '50K_150K',
  investmentExperience: 'GOOD',
  restrictions: [],
  effectiveFrom: '2026-01-01T00:00:00.000Z',
};

test('unknown ruleVersionId surfaces as a structured deny', () => {
  const out = handleRegBI({
    profile,
    recommendationKind: 'BUY',
    product: {
      productId: 'P1',
      symbol: 'XYZ',
      riskTier: 'MEDIUM',
      totalCostBps: 100,
      liquidityScore: 0.5,
      isComplex: false,
      alternativesConsidered: [{ productId: 'P2', totalCostBps: 95, rationale: '' }],
    },
    formCrsLastDeliveredAt: '2026-01-01T00:00:00.000Z',
    conflicts: [],
    ruleVersionId: 'regbi-1999-q1', // not registered
  });
  assert.equal(out.kind, 'denied');
  if (out.kind === 'denied') {
    assert.equal(out.reason, 'unknown-rule-version');
    assert.equal(out.ruleVersionId, 'regbi-1999-q1');
  }
});

test('known ruleVersionId yields evaluated result', () => {
  const out = handleRegBI({
    profile,
    recommendationKind: 'BUY',
    product: {
      productId: 'P1',
      symbol: 'XYZ',
      riskTier: 'MEDIUM',
      totalCostBps: 100,
      liquidityScore: 0.5,
      isComplex: false,
      alternativesConsidered: [{ productId: 'P2', totalCostBps: 95, rationale: '' }],
    },
    formCrsLastDeliveredAt: '2026-01-01T00:00:00.000Z',
    conflicts: [],
    ruleVersionId: 'regbi-2026-q2',
  });
  assert.equal(out.kind, 'evaluated');
});
