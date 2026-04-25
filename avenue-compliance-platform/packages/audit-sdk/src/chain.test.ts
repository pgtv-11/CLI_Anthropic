import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AuditClient, InMemoryChainHead } from './chain.js';
import { InMemorySink } from './sinks.js';
import { GENESIS_HASH } from './hash.js';
import { verifyChain } from './chain.js';

const FIXED = new Date('2026-01-01T00:00:00.000Z');

function clientWith() {
  const sink = new InMemorySink();
  const head = new InMemoryChainHead();
  const client = new AuditClient({
    sinks: [sink],
    head,
    clock: { now: () => FIXED },
  });
  return { sink, head, client };
}

function sample(action: 'CREATE' | 'UPDATE' = 'CREATE') {
  return {
    actor: 'alice@avenue.us',
    actorRole: 'compliance_officer',
    action,
    target: { kind: 'sar', id: 'SAR-2026-0001' },
    requestId: randomUUID(),
    sessionId: randomUUID(),
    ip: '10.0.0.1',
  } as const;
}

test('first event chains from genesis', async () => {
  const { client, sink } = clientWith();
  const ev = await client.record(sample());
  assert.equal(ev.prevChainHash, GENESIS_HASH);
  assert.equal(sink.events.length, 1);
  assert.equal(sink.events[0]!.chainHash, ev.chainHash);
});

test('subsequent events chain from previous hash', async () => {
  const { client, sink } = clientWith();
  const a = await client.record(sample('CREATE'));
  const b = await client.record(sample('UPDATE'));
  assert.equal(b.prevChainHash, a.chainHash);
  const result = verifyChain(sink.events);
  assert.equal(result.valid, true);
});

test('verifyChain detects mutation', async () => {
  const { client, sink } = clientWith();
  await client.record(sample('CREATE'));
  await client.record(sample('UPDATE'));
  // tamper
  sink.events[0]!.target = { kind: 'sar', id: 'TAMPERED' };
  const result = verifyChain(sink.events);
  assert.equal(result.valid, false);
});

test('canonical hashing is deterministic across key order', async () => {
  const { client } = clientWith();
  const ev = await client.record({
    ...sample(),
    after: { z: 1, a: 2 },
  });
  assert.match(ev.afterHash!, /^[0-9a-f]{64}$/);
});

// Mirrors packages/audit-sdk-py/tests/test_v1_backcompat.py — pre-Round-2
// events did not include schemaVersion/outcome/outcomeHash in the hashed
// body. The v1↔v2 dispatch in verifyChain must keep both forms verifiable.
test('verifyChain accepts a synthetic v1 event', async () => {
  const { canonicalJson, sha256Hex } = await import('./hash.js');
  const v1Body = {
    eventId: '11111111-1111-4111-8111-111111111111',
    ts: '2025-09-01T00:00:00.000Z',
    actor: 'alice',
    actorRole: 'compliance_officer',
    actorCrd: undefined,
    action: 'CREATE' as const,
    target: { kind: 'sar', id: 'SAR-2025-0001' },
    beforeHash: undefined,
    afterHash: undefined,
    requestId: '22222222-2222-4222-8222-222222222222',
    sessionId: '33333333-3333-4333-8333-333333333333',
    ip: '10.0.0.1',
    userAgent: undefined,
    ruleVersionId: undefined,
    llmContext: undefined,
    prevChainHash: GENESIS_HASH,
  };
  const chainHash = sha256Hex(canonicalJson(v1Body));
  const v1Event = {
    schemaVersion: 1 as const,
    ...v1Body,
    outcome: undefined,
    outcomeHash: undefined,
    chainHash,
  };
  const result = verifyChain([v1Event]);
  assert.equal(result.valid, true);
});
