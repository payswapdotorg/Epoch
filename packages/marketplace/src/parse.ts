/**
 * The total parse surface of the marketplace kernel: every entry point
 * validates one serialized document and returns a VALUE or a TYPED ERROR —
 * never an exception. Error classification (mirrors the W006/W007/W010
 * admission precedence: version -> schema -> classifier):
 *
 * 1. `schemaVersion` skew reports as `validation` with an issue at path
 *    ["schemaVersion"] BEFORE other schema diagnostics, so version skew is
 *    always distinguishable from malformed payloads;
 * 2. strict-object `unrecognized_keys` rejections classify as
 *    `vendor-fields-rejected` (provider/vendor structural fields can never
 *    enter marketplace records);
 * 3. pricing-model failures classify as `invalid-pricing-model` with
 *    precise dotted-path issues (unknown discriminator or malformed
 *    per-model fields);
 * 4. everything else is `validation` with flattened dotted-path issues.
 */
import type { ZodError } from 'zod';
import { MARKETPLACE_RECORD_VERSION } from './version';
import { parsePricingModelValue, type PricingModel } from './pricing';
import { TrustEvidenceRecordSchema, type TrustEvidenceRecord } from './trust';
import {
  ListingVersionContentSchema,
  SealedListingVersionSchema,
  type ListingVersionContent,
  type SealedListingVersion,
} from './listing';
import {
  EntitlementGrantRecordSchema,
  EntitlementRevokeRecordSchema,
  type EntitlementGrantRecord,
  type EntitlementRevokeRecord,
} from './entitlement';
import {
  SealedUsageEventSchema,
  UsageEventContentSchema,
  type SealedUsageEvent,
  type UsageEventContent,
} from './usage';
import { RevenueRecordSchema, type RevenueRecord } from './revenue';
import {
  PaymentCheckOutcomeSchema,
  PaymentCheckRequestSchema,
  type PaymentCheckOutcome,
  type PaymentCheckRequest,
} from './payment-port';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { MarketplaceError, MarketplaceResult } from './errors';

/** The expected serialized version discriminator (1). */
const EXPECTED_VERSION = MARKETPLACE_RECORD_VERSION;

/** Detect schemaVersion skew before full schema validation (typed issue). */
function versionSkew(value: unknown): MarketplaceError | null {
  if (typeof value !== 'object' || value === null || !('schemaVersion' in value)) {
    return null;
  }
  const encountered = (value as { schemaVersion: unknown }).schemaVersion;
  if (encountered === EXPECTED_VERSION) return null;
  return {
    code: 'validation',
    message: `schemaVersion skew: expected ${EXPECTED_VERSION}, encountered ${String(encountered)}`,
    issues: [
      {
        path: 'schemaVersion',
        message: `expected ${EXPECTED_VERSION}, encountered ${String(encountered)}`,
      },
    ],
  };
}

/** Classify a zod failure of a plain record: vendor fields vs validation. */
function classify(error: ZodError): MarketplaceError {
  if (hasUnrecognizedKeys(error)) {
    return vendorFieldsError(error);
  }
  return validationError(error);
}

/** Parse with the version-skew precheck, then vendor/validation classification. */
function parseWith<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: ZodError } },
  value: unknown,
): MarketplaceResult<T> {
  const skew = versionSkew(value);
  if (skew !== null) {
    return { ok: false, error: skew };
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: classify(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse one pricing model. Classification: an unknown/malformed
 * discriminator or malformed per-model fields → `invalid-pricing-model`
 * with precise dotted-path issues; unknown structural fields →
 * `vendor-fields-rejected`. (The classifier lives in pricing.ts so the
 * listing seal path can share it without an import cycle.)
 */
export function parsePricingModel(value: unknown): MarketplaceResult<PricingModel> {
  const outcome = parsePricingModelValue(value);
  if (outcome.ok) {
    return { ok: true, value: outcome.value };
  }
  return { ok: false, error: outcome.error };
}

/** Parse one W006-shaped trust-evidence record. */
export function parseTrustEvidenceRecord(value: unknown): MarketplaceResult<TrustEvidenceRecord> {
  return parseWith(TrustEvidenceRecordSchema, value);
}

/** Parse one listing version content (unsealed). */
export function parseListingVersionContent(value: unknown): MarketplaceResult<ListingVersionContent> {
  // Pricing classification runs FIRST so an invalid pricing model reports
  // with its precise taxonomy code rather than generic validation.
  if (typeof value === 'object' && value !== null && 'pricing' in value) {
    const pricing = parsePricingModel((value as { pricing: unknown }).pricing);
    if (!pricing.ok) {
      return pricing;
    }
  }
  return parseWith(ListingVersionContentSchema, value);
}

/** Parse one sealed listing version envelope (digest verified separately). */
export function parseSealedListingVersion(value: unknown): MarketplaceResult<SealedListingVersion> {
  if (typeof value === 'object' && value !== null && 'pricing' in value) {
    const pricing = parsePricingModel((value as { pricing: unknown }).pricing);
    if (!pricing.ok) {
      return pricing;
    }
  }
  return parseWith(SealedListingVersionSchema, value);
}

/** Parse one entitlement grant record. */
export function parseEntitlementGrant(value: unknown): MarketplaceResult<EntitlementGrantRecord> {
  return parseWith(EntitlementGrantRecordSchema, value);
}

/** Parse one entitlement revocation record. */
export function parseEntitlementRevoke(value: unknown): MarketplaceResult<EntitlementRevokeRecord> {
  return parseWith(EntitlementRevokeRecordSchema, value);
}

/** Parse one usage event content (W010 shape, any payload family). */
export function parseUsageEventContent(value: unknown): MarketplaceResult<UsageEventContent> {
  return parseWith(UsageEventContentSchema, value);
}

/** Parse one sealed usage event record (digest verified separately). */
export function parseSealedUsageEvent(value: unknown): MarketplaceResult<SealedUsageEvent> {
  return parseWith(SealedUsageEventSchema, value);
}

/** Parse one developer revenue record. */
export function parseRevenueRecord(value: unknown): MarketplaceResult<RevenueRecord> {
  return parseWith(RevenueRecordSchema, value);
}

/** Parse one payment check outcome. */
export function parsePaymentCheckOutcome(value: unknown): MarketplaceResult<PaymentCheckOutcome> {
  return parseWith(PaymentCheckOutcomeSchema, value);
}

/** Parse one payment check request. */
export function parsePaymentCheckRequest(value: unknown): MarketplaceResult<PaymentCheckRequest> {
  // Pricing classification runs FIRST so an invalid pricing model reports
  // with its precise taxonomy code rather than generic validation.
  if (typeof value === 'object' && value !== null && 'pricing' in value) {
    const pricing = parsePricingModel((value as { pricing: unknown }).pricing);
    if (!pricing.ok) {
      return pricing;
    }
  }
  return parseWith(PaymentCheckRequestSchema, value);
}
