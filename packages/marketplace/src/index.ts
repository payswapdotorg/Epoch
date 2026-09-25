/**
 * @epoch/marketplace — public API (kernel layer, Work Order W023).
 *
 * The marketplace DOMAIN MODEL Epoch owns (architecture.md, binding):
 * listings, trust metadata, versions, entitlements, usage accounting, and
 * developer revenue records — typed, versioned, evidence-grade data:
 *
 * - **Listings** publish IMMUTABLE, content-addressed, hash-chained
 *   versions (W011-style sealed envelopes): `sealListingVersion`,
 *   `verifySealedListingVersion`, `verifyListingVersionChain`. Version
 *   references point at the W007 capability-registry vocabulary
 *   (`admitCapabilityReferences` — dangling refs are typed rejections).
 * - **Pricing models** are typed data only: the closed vocabulary free /
 *   one-time / subscription / seat-workspace / usage-metered / hybrid /
 *   enterprise-private, per-model typed fields, no monetization logic.
 * - **Trust metadata** is W006-shaped evidence records (mirrored, pinned by
 *   parity — never a runtime dependency).
 * - **Entitlements** are explicit Epoch-owned records with PURE check
 *   functions: `checkEntitlement` reads grant/revoke records ONLY — payment
 *   state is never authority (lock rule 11) and revocation flips the check
 *   IMMEDIATELY.
 * - **Usage accounting** is append-only typed events over the W010 event
 *   shapes (`sealUsageEvent`, `foldUsageEvents`), one stream per
 *   entitlement, deterministic decimal totals.
 * - **Developer revenue records** are record-keeping only (no payout
 *   logic).
 * - **PaymentPort** is the provider-neutral adapter seam expressing CHECKS
 *   and record-shaped outcomes ONLY (in-memory reference impl; no payment
 *   processing, no credentials, no network).
 *
 * Runtime dependency policy (W023 Tech Lead pin): @epoch/agent-protocol
 * (ids, digests, canonical JSON, version discriminators),
 * @epoch/capability-registry (the W007 capability/version vocabulary
 * listings reference), and @epoch/tenancy (the W009 tenant grammar) are
 * the ONLY @epoch runtime dependencies. Compatibility with
 * @epoch/evidence, @epoch/identity, @epoch/authorization,
 * @epoch/extension-sdk, @epoch/event-log, and @epoch/experience-protocol
 * is pinned via devDependencies + compile-time parity
 * (src/kernel-parity.ts) and runtime parity tests — never runtime deps.
 *
 * The published contract surface lives INSIDE the package (the
 * W006/W009/W010 precedent): the typed index export below, the runtime
 * zod validators in the domain modules, and the committed JSON Schema
 * projection under `schemas/` pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  BILLING_PERIODS,
  ENTITLEMENT_PROVENANCE_KINDS,
  CONFIDENCE_METHODS,
  INTERVAL_BIASES,
  LISTING_ID_PATTERN,
  LISTING_LIFECYCLE_STATES,
  LISTING_LIFECYCLE_TRANSITIONS,
  LISTING_VISIBILITIES,
  LISTING_VERSION_SCHEMA_NAME,
  MARKETPLACE_CONTRACT_VERSION,
  MARKETPLACE_PRINCIPAL_ID_PATTERN,
  MARKETPLACE_RECORD_VERSION,
  PAYMENT_CHECK_RESULTS,
  PAYMENT_PORT_ID_PATTERN,
  PRICING_MODEL_KINDS,
  REVENUE_BASIS,
  ENTITLEMENT_ID_PATTERN,
  REVOCATION_ID_PATTERN,
  REVENUE_ID_PATTERN,
  TRUST_EVIDENCE_KINDS,
  USAGE_EVENT_DISCRIMINATOR,
  USAGE_EVENT_RECORD_VERSION,
  USAGE_STREAM_ID_PATTERN,
  kindPrefixOf,
  usageStreamIdOf,
} from './version';
export type {
  BillingPeriod,
  EntitlementProvenanceKind,
  ListingLifecycleState,
  ListingVisibility,
  PaymentCheckResultKind,
  PricingModelKind,
  RevenueBasis,
} from './version';

// Published contract types.
export type {
  EntitlementQuery,
  EntitlementCheckPositive,
  EntitlementGrantRecord,
  EntitlementProvenance,
  EntitlementRevokeRecord,
  EntitlementScope,
} from './entitlement';
export type {
  CapabilityVersionReference,
  ListingChainSummary,
  ListingVersionContent,
  SealedListingVersion,
} from './listing';
export type {
  EnterprisePrivatePricing,
  FixedPricingComponent,
  FreePricing,
  HybridPricing,
  OneTimePricing,
  PricingModel,
  SeatWorkspacePricing,
  SubscriptionPricing,
  UsageMeteredPricing,
} from './pricing';
export type { RevenueProvenance, RevenueRecord } from './revenue';
export type {
  PaymentCheckOutcome,
  PaymentCheckRequest,
  PaymentPort,
  PaymentPortStateEntry,
} from './payment-port';
export type {
  TrustConfidence,
  TrustConfidenceDistribution,
  TrustConfidenceMethod,
  TrustEvidenceKind,
  TrustEvidencePayload,
  TrustEvidenceProduction,
  TrustEvidenceRecord,
  TrustExactRevisionRef,
  TrustIntervalBias,
} from './trust';
export type {
  SealedUsageEvent,
  UsageAccount,
  UsageCausalParent,
  UsageEventData,
  UsageEventContent,
  UsageEventPayload,
  UsageEventSequence,
  UsageStreamId,
} from './usage';
export type {
  CurrencyCode,
  EntitlementId,
  ListingId,
  NonNegativeDecimal,
  OpaqueReference,
  PaymentPortId,
  PositiveInteger,
  PrincipalId,
  QualifiedName,
  RevocationId,
  RevenueId,
  SemverCore,
  Sha256Hex,
} from './primitives';
export type {
  EntitlementQueryEcho,
  MarketplaceError,
  MarketplaceErrorCode,
  MarketplaceIssue,
  MarketplaceResult,
} from './errors';

// Runtime validators (zod).
export { TenantIdSchema, WorkspaceIdSchema } from '@epoch/tenancy';
export { TimestampSchema } from '@epoch/agent-protocol';
export {
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
  SHA256_HEX_PATTERN,
  Sha256HexSchema,
} from './primitives';
export {
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
export {
  MEDIA_TYPE_PATTERN,
  TrustConfidenceDistributionSchema,
  TrustConfidenceMethodSchema,
  TrustConfidenceSchema,
  TrustEvidenceKindSchema,
  TrustEvidencePayloadSchema,
  TrustEvidenceProductionSchema,
  TrustEvidenceRecordSchema,
  TrustExactRevisionRefSchema,
  TrustIntervalBiasSchema,
  computeTrustEvidenceDigest,
  trustEvidenceOrderKey,
} from './trust';
export {
  CapabilityVersionReferenceSchema,
  ListingVersionContentSchema,
  ListingVisibilitySchema,
  SealedListingVersionSchema,
  admitCapabilityReferences,
  computeListingVersionDigest,
  sealListingVersion,
  verifyListingVersionChain,
  verifySealedListingVersion,
} from './listing';
export type { CapabilityVersionResolver } from './listing';
export {
  EntitlementGrantRecordSchema,
  EntitlementProvenanceSchema,
  EntitlementRevokeRecordSchema,
  EntitlementScopeSchema,
  checkEntitlement,
} from './entitlement';
export {
  SealedUsageEventSchema,
  UsageAccountSchema,
  UsageCausalParentSchema,
  UsageEventDataSchema,
  UsageEventContentSchema,
  UsageEventPayloadSchema,
  UsageEventSequenceSchema,
  UsageStreamIdSchema,
  addNonNegativeDecimals,
  computeUsageEventDigest,
  foldUsageEvents,
  parseUsageEventData,
  sealUsageEvent,
  verifySealedUsageEvent,
} from './usage';
export { RevenueProvenanceSchema, RevenueRecordSchema, validateRevenueRecord } from './revenue';
export {
  InMemoryPaymentPort,
  PaymentCheckOutcomeSchema,
  PaymentCheckRequestSchema,
} from './payment-port';

// Total parse surface (errors are values, never exceptions).
export {
  parseEntitlementGrant,
  parseEntitlementRevoke,
  parseListingVersionContent,
  parsePaymentCheckOutcome,
  parsePaymentCheckRequest,
  parsePricingModel,
  parseRevenueRecord,
  parseSealedListingVersion,
  parseSealedUsageEvent,
  parseTrustEvidenceRecord,
  parseUsageEventContent,
} from './parse';

// Issue helpers (zod -> typed issues classification).
export {
  flattenZodIssues,
  hasUnrecognizedKeys,
  unrecognizedKeysPath,
  validationError,
  vendorFieldsError,
} from './issues';

// Published schema surface + deterministic contract emission.
export { MARKETPLACE_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  MARKETPLACE_CONTRACT_DIR,
  renderMarketplaceContractFiles,
  typeToKebabCase,
} from './contract-emission';
