/**
 * Developer revenue records (architecture.md, binding: "Epoch owns ...
 * developer revenue records"). RECORD-KEEPING ONLY — there is no payout,
 * settlement, invoice, or tax logic anywhere in this package: a revenue
 * record states that an amount in a currency accrued to the developer
 * tenant on a basis tied to one exact published listing version, with full
 * provenance back to the generating record (usage event digest,
 * entitlement id, or a manual entry reference). Payment execution stays
 * behind the PaymentPort seam; payout is a future adapter, never kernel
 * semantics.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import {
  CurrencyCodeSchema,
  EntitlementIdSchema,
  ListingIdSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  RevenueIdSchema,
  Sha256HexSchema,
  TenantIdSchema,
} from './primitives';
import { REVENUE_BASIS } from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { MarketplaceResult } from './errors';

/** The provenance of a revenue record: what generated the accrued amount. */
export const RevenueProvenanceSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({
        kind: z.literal('usage-event'),
        usageEventDigest: Sha256HexSchema,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('entitlement'),
        entitlementId: EntitlementIdSchema,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('manual-entry'),
        reference: z.string().min(1).max(256),
      })
      .readonly(),
  ])
  .meta({
    id: 'RevenueProvenance',
    title: 'RevenueProvenance',
    description:
      'Revenue provenance: the usage event digest, entitlement id, or manual-entry reference that generated the accrued amount.',
  });

/** One revenue provenance. */
export type RevenueProvenance = z.infer<typeof RevenueProvenanceSchema>;

/**
 * One developer revenue record: developer tenant, acquiring tenant, exact
 * published listing version, basis, canonical decimal amount + ISO 4217
 * currency, recording instant/actor, and provenance. Record-keeping only.
 */
export const RevenueRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    revenueId: RevenueIdSchema,
    developerTenantId: TenantIdSchema,
    acquiringTenantId: TenantIdSchema,
    listingId: ListingIdSchema,
    listingVersionDigest: Sha256HexSchema,
    entitlementId: EntitlementIdSchema.optional(),
    basis: z.enum(REVENUE_BASIS),
    amount: NonNegativeDecimalSchema,
    currency: CurrencyCodeSchema,
    recordedAt: TimestampSchema,
    recordedBy: PrincipalIdSchema,
    provenance: RevenueProvenanceSchema,
  })
  .readonly()
  .meta({
    id: 'RevenueRecord',
    title: 'RevenueRecord',
    description:
      'One developer revenue record: accrued amount (record-keeping only, no payout logic) with full provenance to the generating record. Tenant-scoped on both the developer and acquiring side.',
  });

/** One revenue record. */
export type RevenueRecord = z.infer<typeof RevenueRecordSchema>;

/**
 * Validate a revenue record (total). Strict-object rejections classify as
 * `vendor-fields-rejected`; everything else is `validation` with flattened
 * dotted-path issues.
 */
export function validateRevenueRecord(record: unknown): MarketplaceResult<RevenueRecord> {
  const parsed = RevenueRecordSchema.safeParse(record);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
