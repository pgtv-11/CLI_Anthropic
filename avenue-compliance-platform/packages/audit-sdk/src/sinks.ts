import { AuditEvent, AuditSink } from './types.js';

export class InMemorySink implements AuditSink {
  readonly events: AuditEvent[] = [];
  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

export interface S3ObjectLockConfig {
  bucket: string;
  region: string;
  prefix: string;
  retentionMode: 'COMPLIANCE' | 'GOVERNANCE';
  retentionDays: number;
}

/**
 * Sink that mirrors every event to an S3 Object Lock (Compliance mode) bucket.
 * The actual AWS SDK call is intentionally abstracted: production wiring must
 * inject a writer that fails-closed (any S3 error must surface — never swallow).
 */
export class S3ObjectLockSink implements AuditSink {
  constructor(
    private readonly cfg: S3ObjectLockConfig,
    private readonly putObject: (
      key: string,
      body: string,
      retainUntil: Date,
      mode: 'COMPLIANCE' | 'GOVERNANCE',
    ) => Promise<void>,
  ) {
    if (cfg.retentionMode !== 'COMPLIANCE') {
      throw new Error('audit-sdk: GOVERNANCE mode forbidden for audit log; use COMPLIANCE');
    }
    if (cfg.retentionDays < 365 * 7) {
      throw new Error('audit-sdk: retentionDays must be >= 7 years for SEC 17a-4 alignment');
    }
  }

  async append(event: AuditEvent): Promise<void> {
    const key = `${this.cfg.prefix}/${event.ts.slice(0, 10)}/${event.eventId}.json`;
    const body = JSON.stringify(event);
    const retainUntil = new Date(Date.now() + this.cfg.retentionDays * 86400_000);
    await this.putObject(key, body, retainUntil, this.cfg.retentionMode);
  }
}
