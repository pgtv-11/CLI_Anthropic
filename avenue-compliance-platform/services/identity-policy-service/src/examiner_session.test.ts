import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signExaminerSession,
  verifyExaminerSession,
  type ExaminerSessionClaims,
} from './examiner_session.js';

const SECRET = Buffer.from('a'.repeat(64), 'hex');
const NOW = new Date('2026-04-25T12:00:00Z');
const CLAIMS: ExaminerSessionClaims = {
  id: 'ex-2026-04-25-1',
  expiresAt: '2026-05-25T12:00:00Z',
  issuedAt: '2026-04-25T12:00:00Z',
  examinerCrd: '12345678',
  matterId: 'MATTER-42',
};

test('signed session verifies under same secret', () => {
  const signed = signExaminerSession(CLAIMS, SECRET);
  const result = verifyExaminerSession(signed, SECRET, NOW);
  assert.equal(result.valid, true);
});

test('forged watermark is rejected', () => {
  const forged = { ...CLAIMS, watermark: '0'.repeat(64) };
  const result = verifyExaminerSession(forged, SECRET, NOW);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'watermark-mismatch');
});

test('expired session is rejected even with valid watermark', () => {
  const signed = signExaminerSession(
    { ...CLAIMS, expiresAt: '2026-04-24T00:00:00Z' },
    SECRET,
  );
  const result = verifyExaminerSession(signed, SECRET, NOW);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'session-expired');
});

test('mutated matterId fails verification', () => {
  const signed = signExaminerSession(CLAIMS, SECRET);
  const mutated = { ...signed, matterId: 'MATTER-99' };
  const result = verifyExaminerSession(mutated, SECRET, NOW);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'watermark-mismatch');
});
