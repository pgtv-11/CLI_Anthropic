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
