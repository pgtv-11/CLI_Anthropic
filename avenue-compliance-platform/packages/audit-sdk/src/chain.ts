import { randomUUID } from 'node:crypto';
import { GENESIS_HASH, canonicalJson, hashPayload, sha256Hex } from './hash.js';
import {
  AUDIT_EVENT_SCHEMA_VERSION,
  AuditEvent,
  AuditEventInput,
  AuditEventInputSchema,
  AuditSink,
} from './types.js';

export interface ClockSource {
  now(): Date;
}

export interface ChainHeadStore {
  get(): Promise<string>;
  compareAndSet(prev: string, next: string): Promise<boolean>;
}

export class InMemoryChainHead implements ChainHeadStore {
  private head: string = GENESIS_HASH;
  async get(): Promise<string> {
    return this.head;
  }
  async compareAndSet(prev: string, next: string): Promise<boolean> {
    if (this.head !== prev) return false;
    this.head = next;
    return true;
  }
}

export interface AuditClientOptions {
  sinks: AuditSink[];
  head: ChainHeadStore;
  clock?: ClockSource;
  maxRetries?: number;
}

export class AuditClient {
  private readonly sinks: AuditSink[];
  private readonly head: ChainHeadStore;
  private readonly clock: ClockSource;
  private readonly maxRetries: number;

  constructor(opts: AuditClientOptions) {
    if (opts.sinks.length < 1) throw new Error('audit-sdk: at least one sink required');
    this.sinks = opts.sinks;
    this.head = opts.head;
    this.clock = opts.clock ?? { now: () => new Date() };
    this.maxRetries = opts.maxRetries ?? 5;
  }

  async record(input: AuditEventInput): Promise<AuditEvent> {
    const parsed = AuditEventInputSchema.parse(input);
    const eventId = randomUUID();
    const ts = this.clock.now().toISOString();
    const beforeHash = parsed.before ? hashPayload(parsed.before) : undefined;
    const afterHash = parsed.after ? hashPayload(parsed.after) : undefined;
    const outcomeHash = parsed.outcomeDetails
      ? hashPayload({ outcome: parsed.outcome, details: parsed.outcomeDetails })
      : parsed.outcome
        ? hashPayload({ outcome: parsed.outcome })
        : undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const prev = await this.head.get();
      const partial: Omit<AuditEvent, 'chainHash'> = {
        schemaVersion: AUDIT_EVENT_SCHEMA_VERSION,
        eventId,
        ts,
        actor: parsed.actor,
        actorRole: parsed.actorRole,
        actorCrd: parsed.actorCrd,
        action: parsed.action,
        target: parsed.target,
        beforeHash,
        afterHash,
        outcome: parsed.outcome,
        outcomeHash,
        requestId: parsed.requestId,
        sessionId: parsed.sessionId,
        ip: parsed.ip,
        userAgent: parsed.userAgent,
        ruleVersionId: parsed.ruleVersionId,
        llmContext: parsed.llmContext,
        prevChainHash: prev,
      };
      const chainHash = sha256Hex(canonicalJson(partial));
      const event: AuditEvent = { ...partial, chainHash };

      const ok = await this.head.compareAndSet(prev, chainHash);
      if (!ok) continue;

      await Promise.all(this.sinks.map((s) => s.append(event)));
      return event;
    }
    throw new Error('audit-sdk: chain head contention exceeded retries');
  }
}

export function verifyChain(events: AuditEvent[]): { valid: boolean; brokenAt?: string } {
  let prev = GENESIS_HASH;
  for (const ev of events) {
    if (ev.prevChainHash !== prev) return { valid: false, brokenAt: ev.eventId };
    const { chainHash, ...rest } = ev;
    // Schema-version dispatch: v1 events did not include outcome/outcomeHash
    // in the hashed body. Strip those fields when verifying a v1 record so
    // archived chains stay valid after the v2 upgrade.
    const hashedShape =
      ev.schemaVersion === 1
        ? (() => {
            const { outcome: _o, outcomeHash: _oh, schemaVersion: _sv, ...v1 } = rest;
            return v1;
          })()
        : rest;
    const recomputed = sha256Hex(canonicalJson(hashedShape));
    if (recomputed !== chainHash) return { valid: false, brokenAt: ev.eventId };
    prev = chainHash;
  }
  return { valid: true };
}
