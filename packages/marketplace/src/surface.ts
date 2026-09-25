/**
 * The marketplace schema-surface registry: every data type published at the
 * `@epoch/marketplace` ownership boundary, paired with its zod schema.
 *
 * W023 owns no top-level `contracts/` directory, so the versioned contract
 * surface is published INSIDE the package (the W006/W009/W010 precedent):
 * this ordered surface plus the emitted JSON Schema files under `schemas/`
 * (see src/contract-emission.ts) plus the typed index export. Invariants
 * enforced by test/contract-drift.test.ts: every committed schema file is
 * byte-identical to the deterministic emission of its surface entry.
 */
import { z, type ZodType } from 'zod';
import {
  CurrencyCodeSchema,
  EntitlementIdSchema,
  ListingIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PaymentPortIdSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  QualifiedNameSchema,
  RevocationIdSchema,
  RevenueIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
} from './primitives';
import {
  EnterprisePrivatePricingSchema,
  FixedPricingComponentSchema,
  FreePricingSchema,
  HybridPricingSchema,
  OneTimePricingSchema,
  PricingModelSchema,
  SeatWorkspacePricingSchema,
  SubscriptionPricingSchema,
  UsageMeteredPricingSchema,
} from './pricing';
import {
  TrustConfidenceDistributionSchema,
  TrustConfidenceMethodSchema,
  TrustConfidenceSchema,
  TrustEvidenceKindSchema,
  TrustEvidencePayloadSchema,
  TrustEvidenceProductionSchema,
  TrustEvidenceRecordSchema,
  TrustExactRevisionRefSchema,
  TrustIntervalBiasSchema,
} from './trust';
import {
  CapabilityVersionReferenceSchema,
  ListingVersionContentSchema,
  ListingVisibilitySchema,
  SealedListingVersionSchema,
} from './listing';
import {
  EntitlementGrantRecordSchema,
  EntitlementProvenanceSchema,
  EntitlementRevokeRecordSchema,
  EntitlementScopeSchema,
} from './entitlement';
import {
  SealedUsageEventSchema,
  UsageAccountSchema,
  UsageCausalParentSchema,
  UsageEventDataSchema,
  UsageEventContentSchema,
  UsageEventPayloadSchema,
  UsageEventSequenceSchema,
  UsageStreamIdSchema,
} from './usage';
import { RevenueProvenanceSchema, RevenueRecordSchema } from './revenue';
import { PaymentCheckOutcomeSchema, PaymentCheckRequestSchema } from './payment-port';
import { BILLING_PERIODS, PAYMENT_CHECK_RESULTS, REVENUE_BASIS } from './version';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

const BillingPeriodSchema = z.enum(BILLING_PERIODS).meta({
  id: 'BillingPeriod',
  title: 'BillingPeriod',
  description: 'Billing period admitted by subscription and seat/workspace pricing: monthly or annual.',
});

const RevenueBasisSchema = z.enum(REVENUE_BASIS).meta({
  id: 'RevenueBasis',
  title: 'RevenueBasis',
  description: 'Developer revenue basis: one-time, subscription, seat, or usage.',
});

const PaymentCheckResultSchema = z.enum(PAYMENT_CHECK_RESULTS).meta({
  id: 'PaymentCheckResult',
  title: 'PaymentCheckResult',
  description:
    'Closed payment check result vocabulary: not-required, settled, unpaid, declined, refunded, unknown-charge.',
});

/** The complete, ordered data-type surface of the marketplace contract v1. */
export const MARKETPLACE_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  // Primitives.
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'ListingId', schema: ListingIdSchema },
  { type: 'EntitlementId', schema: EntitlementIdSchema },
  { type: 'RevocationId', schema: RevocationIdSchema },
  { type: 'RevenueId', schema: RevenueIdSchema },
  { type: 'PaymentPortId', schema: PaymentPortIdSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'SemverCore', schema: SemverCoreSchema },
  { type: 'CurrencyCode', schema: CurrencyCodeSchema },
  { type: 'NonNegativeDecimal', schema: NonNegativeDecimalSchema },
  { type: 'PositiveInteger', schema: PositiveIntegerSchema },
  { type: 'OpaqueReference', schema: OpaqueReferenceSchema },
  { type: 'QualifiedName', schema: QualifiedNameSchema },
  // Pricing models (typed data only).
  { type: 'PricingModel', schema: PricingModelSchema },
  { type: 'FreePricing', schema: FreePricingSchema },
  { type: 'OneTimePricing', schema: OneTimePricingSchema },
  { type: 'SubscriptionPricing', schema: SubscriptionPricingSchema },
  { type: 'SeatWorkspacePricing', schema: SeatWorkspacePricingSchema },
  { type: 'UsageMeteredPricing', schema: UsageMeteredPricingSchema },
  { type: 'HybridPricing', schema: HybridPricingSchema },
  { type: 'EnterprisePrivatePricing', schema: EnterprisePrivatePricingSchema },
  { type: 'FixedPricingComponent', schema: FixedPricingComponentSchema },
  { type: 'BillingPeriod', schema: BillingPeriodSchema },
  // Trust evidence (W006-shaped).
  { type: 'TrustEvidenceRecord', schema: TrustEvidenceRecordSchema },
  { type: 'TrustEvidenceKind', schema: TrustEvidenceKindSchema },
  { type: 'TrustEvidenceProduction', schema: TrustEvidenceProductionSchema },
  { type: 'TrustEvidencePayload', schema: TrustEvidencePayloadSchema },
  { type: 'TrustExactRevisionRef', schema: TrustExactRevisionRefSchema },
  { type: 'TrustConfidence', schema: TrustConfidenceSchema },
  { type: 'TrustConfidenceDistribution', schema: TrustConfidenceDistributionSchema },
  { type: 'TrustConfidenceMethod', schema: TrustConfidenceMethodSchema },
  { type: 'TrustIntervalBias', schema: TrustIntervalBiasSchema },
  // Listings + immutable published versions.
  { type: 'CapabilityVersionReference', schema: CapabilityVersionReferenceSchema },
  { type: 'ListingVisibility', schema: ListingVisibilitySchema },
  { type: 'ListingVersionContent', schema: ListingVersionContentSchema },
  { type: 'SealedListingVersion', schema: SealedListingVersionSchema },
  // Entitlements.
  { type: 'EntitlementScope', schema: EntitlementScopeSchema },
  { type: 'EntitlementProvenance', schema: EntitlementProvenanceSchema },
  { type: 'EntitlementGrantRecord', schema: EntitlementGrantRecordSchema },
  { type: 'EntitlementRevokeRecord', schema: EntitlementRevokeRecordSchema },
  // Usage accounting (W010 event shapes).
  { type: 'UsageStreamId', schema: UsageStreamIdSchema },
  { type: 'UsageEventSequence', schema: UsageEventSequenceSchema },
  { type: 'UsageCausalParent', schema: UsageCausalParentSchema },
  { type: 'UsageEventPayload', schema: UsageEventPayloadSchema },
  { type: 'UsageEventData', schema: UsageEventDataSchema },
  { type: 'UsageEventContent', schema: UsageEventContentSchema },
  { type: 'SealedUsageEvent', schema: SealedUsageEventSchema },
  { type: 'UsageAccount', schema: UsageAccountSchema },
  // Developer revenue records.
  { type: 'RevenueBasis', schema: RevenueBasisSchema },
  { type: 'RevenueProvenance', schema: RevenueProvenanceSchema },
  { type: 'RevenueRecord', schema: RevenueRecordSchema },
  // Payment port seam.
  { type: 'PaymentCheckRequest', schema: PaymentCheckRequestSchema },
  { type: 'PaymentCheckOutcome', schema: PaymentCheckOutcomeSchema },
  { type: 'PaymentCheckResult', schema: PaymentCheckResultSchema },
];
