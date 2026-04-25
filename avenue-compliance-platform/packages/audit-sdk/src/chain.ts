import { randomUUID } from 'node:crypto';
import { GENESIS_HASH, canonicalJson, hashPayload, sha256Hex } from './hash.js';
import {
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

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const prev = await this.head.get();
      const partial: Omit<AuditEvent, 'chainHash'> = {
        eventId,
        ts,
        actor: parsed.actor,
        actorRole: parsed.actorRole,
        actorCrd: parsed.actorCrd,
        action: parsed.action,
        target: parsed.target,
        beforeHash,
        afterHash,
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
    const recomputed = sha256Hex(canonicalJson(rest));
    if (recomputed !== chainHash) return { valid: false, brokenAt: ev.eventId };
    prev = chainHash;
  }
  return { valid: true };
}
