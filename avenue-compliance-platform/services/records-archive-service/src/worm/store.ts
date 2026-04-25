import {
  ObjectLockLegalHoldStatus,
  ObjectLockMode,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { z } from 'zod';

// WormStore — the only legitimate writer to the records-archive WORM bucket.
// Every put forces Object Lock COMPLIANCE retention; callers cannot opt out.

export const StoreInputSchema = z.object({
  key: z.string().min(1),
  body: z.instanceof(Uint8Array),
  contentType: z.string().min(1),
  retentionDays: z
    .number()
    .int()
    .min(2190, 'retentionDays must be >= 2190 (~6 years) per SEC 17a-4'),
  legalHold: z.boolean().default(false),
  metadata: z.record(z.string()).default({}),
});
export type StoreInput = z.infer<typeof StoreInputSchema>;

export interface PutResult {
  bucket: string;
  key: string;
  versionId: string | undefined;
  retainUntil: string;
  legalHold: boolean;
}

export class WormStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly kmsKeyId: string,
  ) {}

  async put(raw: StoreInput): Promise<PutResult> {
    const input = StoreInputSchema.parse(raw);
    const retainUntil = new Date(Date.now() + input.retentionDays * 86_400_000);
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: this.kmsKeyId,
      ObjectLockMode: ObjectLockMode.COMPLIANCE,
      ObjectLockRetainUntilDate: retainUntil,
      ObjectLockLegalHoldStatus: input.legalHold
        ? ObjectLockLegalHoldStatus.ON
        : ObjectLockLegalHoldStatus.OFF,
      Metadata: input.metadata,
    });
    const out = await this.client.send(cmd);
    return {
      bucket: this.bucket,
      key: input.key,
      versionId: out.VersionId,
      retainUntil: retainUntil.toISOString(),
      legalHold: input.legalHold,
    };
  }
}
