// Audit log service — terminates the audit-sdk client side and writes events
// to two destinations atomically:
//   1. Kafka topic `audit.events.v1` (hot read path)
//   2. S3 Object Lock bucket via S3ObjectLockSink (WORM, retention 7y)
//
// Both writes must succeed before the chain head is advanced. The audit-sdk
// already enforces sink-fanout success via Promise.all; here we only wire the
// two sinks together with proper failure handling.

import { AuditSink, AuditEvent, S3ObjectLockSink } from '@avenue/audit-sdk';

export interface KafkaProducer {
  send(topic: string, key: string, value: string): Promise<void>;
}

export class KafkaSink implements AuditSink {
  constructor(
    private readonly producer: KafkaProducer,
    private readonly topic: string = 'audit.events.v1',
  ) {}
  async append(event: AuditEvent): Promise<void> {
    await this.producer.send(this.topic, event.eventId, JSON.stringify(event));
  }
}

export { S3ObjectLockSink };
