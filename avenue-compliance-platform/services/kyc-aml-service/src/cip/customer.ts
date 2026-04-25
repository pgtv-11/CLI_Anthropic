import { z } from 'zod';

// Customer Identification Program (CIP) record — 31 CFR 1023.220.
// Brazil-aware: accepts CPF as a tax-ID alternative to SSN/ITIN, and treats
// RG/CNH as foreign government-issued IDs per (a)(2)(ii)(B).

export const CountrySchema = z.string().length(2).toUpperCase();

export const TaxIdSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('SSN'), value: z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/) }),
  z.object({ kind: z.literal('ITIN'), value: z.string().regex(/^9\d{2}-?\d{2}-?\d{4}$/) }),
  z.object({ kind: z.literal('CPF'), value: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/) }),
  z.object({ kind: z.literal('FOREIGN_OTHER'), country: CountrySchema, value: z.string().min(1) }),
]);

export const IdentityDocumentSchema = z.object({
  kind: z.enum(['PASSPORT', 'RG', 'CNH', 'OTHER_FOREIGN']),
  number: z.string().min(1),
  issuer: z.string().min(1),
  issuedAt: z.string().date(),
  expiresAt: z.string().date().optional(),
  scanStorageKey: z.string().min(1),
});
export type IdentityDocument = z.infer<typeof IdentityDocumentSchema>;

export const CustomerSchema = z.object({
  customerId: z.string().uuid(),
  legalName: z.string().min(1),
  dateOfBirth: z.string().date(),
  residenceAddress: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    region: z.string().optional(),
    postalCode: z.string().min(1),
    country: CountrySchema,
  }),
  taxId: TaxIdSchema,
  identityDocuments: z.array(IdentityDocumentSchema).min(1),
  pepFlag: z.boolean(),
  riskTier: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  cipVerifiedAt: z.string().datetime().optional(),
  cipVerifiedBy: z.string().optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
});
export type Customer = z.infer<typeof CustomerSchema>;
