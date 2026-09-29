/**
 * The zod schemas of the portal-OWNED host records: receipts, snapshots,
 * the developer dashboard projection, and the health/describe surfaces
 * (the W024 billing-host receipts discipline, made typed-validators here
 * because W025 also publishes the declaration-only contract tree under
 * `contracts/` — the schemas are the deterministic emission source).
 *
 * Upstream records (sealed listing versions, capability records,
 * entitlement grants, revenue records, billing accounts) are the owning
 * packages' contracts and are NEVER re-schema'd here: they travel through
 * this host as verified values and are referenced opaquely in projections
 * (counts, digests, summaries).
 */
import { z } from 'zod';
import {
  CurrencyCodeSchema,
  ListingIdSchema,
  NonNegativeDecimalSchema,
  Sha256HexSchema,
  TenantIdSchema,
} from '@epoch/marketplace';
import {
  HOST_RECORD_VERSION,
  DEVELOPER_PORTAL_HOST_SERVICE_NAME,
} from './version';

/** The listing lifecycle vocabulary (MIRRORED from the W023 kernel). */
const LISTING_LIFECYCLE_STATES = ['draft', 'submitted', 'published', 'retired'] as const;

/** The listing visibility vocabulary (MIRRORED from the W023 kernel). */
const LISTING_VISIBILITIES = ['public', 'private'] as const;

/** Receipt of listing-draft creation / update (idempotent). */
export const ListingCreationReceiptSchema = z
  .strictObject({
    schemaVersion: z.literal(HOST_RECORD_VERSION),
    listingId: ListingIdSchema,
    lifecycle: z.enum(LISTING_LIFECYCLE_STATES),
    draftDigest: Sha256HexSchema,
    duplicate: z.boolean(),
  })
  .readonly()
  .meta({
    id: 'ListingCreationReceipt',
    title: 'ListingCreationReceipt',
    description:
      'Receipt of a Developer Portal listing-draft creation or update: the derived listing id, lifecycle state, canonical draft digest, and idempotency marker.',
  });
export type ListingCreationReceipt = z.infer<typeof ListingCreationReceiptSchema>;

/** Receipt of publication (the sealed immutable version). */
export const PublicationReceiptSchema = z
  .strictObject({
    schemaVersion: z.literal(HOST_RECORD_VERSION),
    listingId: ListingIdSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    contentDigest: Sha256HexSchema,
    previousVersionDigest: Sha256HexSchema.nullable(),
    chainLength: z.number().int().min(1),
    duplicate: z.boolean(),
  })
  .readonly()
  .meta({
    id: 'PublicationReceipt',
    title: 'PublicationReceipt',
    description:
      'Receipt of a Developer Portal listing-version publication: the sealed version, its chain link, the verified chain length, and the idempotency marker.',
  });
export type PublicationReceipt = z.infer<typeof PublicationReceiptSchema>;

/** Receipt of record adoption (idempotent by record identity). */
export const AdoptionReceiptSchema = z
  .strictObject({
    schemaVersion: z.literal(HOST_RECORD_VERSION),
    recordId: z.string().min(1).max(128),
    recordKind: z.enum(['entitlement-grant', 'entitlement-revocation', 'revenue-record', 'billing-account']),
    duplicate: z.boolean(),
  })
  .readonly()
  .meta({
    id: 'AdoptionReceipt',
    title: 'AdoptionReceipt',
    description:
      'Receipt of a Developer Portal analytics-record adoption (W023 grant/revocation/revenue, W024 billing account): the adopted record id, its kind, and the idempotency marker.',
  });
export type AdoptionReceipt = z.infer<typeof AdoptionReceiptSchema>;

/** One developer-owned listing snapshot (deterministic projection). */
export const ListingSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(HOST_RECORD_VERSION),
    listingId: ListingIdSchema,
    developerTenantId: TenantIdSchema,
    lifecycle: z.enum(LISTING_LIFECYCLE_STATES),
    visibility: z.enum(LISTING_VISIBILITIES),
    displayName: z.string().min(1).max(128),
    publishedVersionCount: z.number().int().min(0),
    headVersion: z.string().regex(/^\d+\.\d+\.\d+$/).nullable(),
    headDigest: Sha256HexSchema.nullable(),
  })
  .readonly()
  .meta({
    id: 'ListingSnapshot',
    title: 'ListingSnapshot',
    description:
      'One developer-owned listing snapshot: derived listing id, developer tenant, lifecycle, visibility, display name, published-version count, and head version pin.',
  });
export type ListingSnapshot = z.infer<typeof ListingSnapshotSchema>;

/** The verified publication-chain summary of one listing. */
export const ChainSummarySchema = z
  .strictObject({
    schemaVersion: z.literal(HOST_RECORD_VERSION),
    listingId: ListingIdSchema,
    versionCount: z.number().int().min(1),
    headVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    headDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ChainSummary',
    title: 'ChainSummary',
    description:
      'The verified publication-chain summary of one developer listing: sealed version count and the head pin (the W023 kernel chain verification projected).',
  });
export type ChainSummary = z.infer<typeof ChainSummarySchema>;

/** The developer's adopted payout (billing) account summary. */
export const PayoutAccountSummarySchema = z
  .strictObject({
    schemaVersion: z.literal(HOST_RECORD_VERSION),
    accountId: z.string().regex(/^billing-account:[a-z0-9][a-z0-9-]{0,54}$/),
    currency: CurrencyCodeSchema,
    displayName: z.string().min(1).max(128),
    openedAt: z.string(),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'PayoutAccountSummary',
    title: 'PayoutAccountSummary',
    description:
      'The developer tenant\'s adopted W024 billing-account summary (where marketplace revenue settles): account id, settlement currency, display name, opening instant, and content digest.',
  });
export type PayoutAccountSummary = z.infer<typeof PayoutAccountSummarySchema>;

/** The developer dashboard (pure deterministic state projection). */
export const DeveloperDashboardSchema = z
  .strictObject({
    schemaVersion: z.literal(HOST_RECORD_VERSION),
    developerTenantId: TenantIdSchema,
    listingCount: z.number().int().min(0),
    listingsByLifecycle: z.record(z.string(), z.number().int().min(0)).readonly(),
    publishedVersionCount: z.number().int().min(0),
    adoptedGrantCount: z.number().int().min(0),
    activeEntitlementCount: z.number().int().min(0),
    revokedEntitlementCount: z.number().int().min(0),
    revenueRecordCount: z.number().int().min(0),
    revenueByCurrency: z.record(z.string(), NonNegativeDecimalSchema).readonly(),
    payoutAccount: PayoutAccountSummarySchema.nullable(),
    registeredCapabilityCount: z.number().int().min(0),
    eventCount: z.number().int().min(0),
  })
  .readonly()
  .meta({
    id: 'DeveloperDashboard',
    title: 'DeveloperDashboard',
    description:
      'The Developer Portal dashboard of one developer tenant: listing/lifecycle counts, published-version total, adopted entitlement analytics (active vs revoked via the REAL marketplace check), revenue folds per currency, the adopted payout account, and registry/stream counters.',
  });
export type DeveloperDashboard = z.infer<typeof DeveloperDashboardSchema>;

/** Health/liveness as typed data (pure state projection). */
export const HealthReportSchema = z
  .strictObject({
    schemaVersion: z.literal(HOST_RECORD_VERSION),
    service: z.literal(DEVELOPER_PORTAL_HOST_SERVICE_NAME),
    status: z.literal('ready'),
    listingCount: z.number().int().min(0),
    listingsByLifecycle: z.record(z.string(), z.number().int().min(0)).readonly(),
    publishedVersionCount: z.number().int().min(0),
    adoptedGrantCount: z.number().int().min(0),
    adoptedRevocationCount: z.number().int().min(0),
    adoptedRevenueCount: z.number().int().min(0),
    adoptedBillingAccountCount: z.number().int().min(0),
    registrySize: z.number().int().min(0),
    eventCount: z.number().int().min(0),
  })
  .readonly()
  .meta({
    id: 'HealthReport',
    title: 'HealthReport',
    description:
      'Developer Portal health/liveness as typed data: a pure deterministic state projection (no wall clock, no randomness, deterministic key order).',
  });
export type HealthReport = z.infer<typeof HealthReportSchema>;

/** The typed service surface description. */
export const ServiceDescriptionSchema = z
  .strictObject({
    schemaVersion: z.literal(HOST_RECORD_VERSION),
    service: z.literal(DEVELOPER_PORTAL_HOST_SERVICE_NAME),
    contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    operations: z.array(z.string().min(1)).readonly(),
    invariants: z.array(z.string().min(1)).readonly(),
  })
  .readonly()
  .meta({
    id: 'ServiceDescription',
    title: 'ServiceDescription',
    description:
      'The typed Developer Portal service surface: identity, contract version, operation list, and enforced invariants.',
  });
export type ServiceDescription = z.infer<typeof ServiceDescriptionSchema>;
