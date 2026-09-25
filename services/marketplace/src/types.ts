/**
 * The marketplace host's typed input/output surface (the W028 host-pattern:
 * plain JSON records, total results, zero clock reads — every instant is
 * caller-supplied payload data).
 */
import type {
  EntitlementGrantRecord,
  EntitlementRevokeRecord,
  EntitlementScope,
  ListingLifecycleState,
  ListingVisibility,
  MarketplaceError,
  MarketplaceResult,
  PaymentCheckOutcome,
  PricingModel,
  RevenueProvenance,
  RevenueRecord,
  SealedListingVersion,
  SealedUsageEvent,
  UsageAccount,
  UsageEventData,
  CapabilityVersionReference,
  TrustEvidenceRecord,
  EntitlementCheckPositive,
} from '@epoch/marketplace';

/** Idempotency key (opaque, bounded). */
export type IdempotencyKey = string;

/** Tenant id (the W009 grammar). */
export type TenantId = string;

/** Principal id (the W009 identity grammar). */
export type PrincipalId = string;

/** The typed host result: a value or a kernel-typed error. */
export type HostResult<T> = MarketplaceResult<T>;

/** The draft fields of a listing (mutable until published). */
export interface ListingDraftInput {
  readonly displayName: string;
  readonly description?: string | undefined;
  readonly capabilityReferences: readonly CapabilityVersionReference[];
  readonly pricing: PricingModel;
  readonly trustEvidence: readonly TrustEvidenceRecord[];
  readonly visibility: ListingVisibility;
  readonly privateAllowList?: readonly TenantId[] | undefined;
}

/** Input of {@link import('./host').MarketplaceHost.createListing}. */
export interface CreateListingInput {
  /** The tenant the listing is created for (the developer tenant). */
  readonly asTenant: TenantId;
  /** Idempotency key: same (key, content) re-derives the same listing. */
  readonly idempotencyKey: IdempotencyKey;
  readonly draft: ListingDraftInput;
}

/** Receipt of listing creation (idempotent). */
export interface ListingCreationReceipt {
  readonly schemaVersion: 1;
  readonly listingId: string;
  readonly lifecycle: ListingLifecycleState;
  readonly draftDigest: string;
  readonly duplicate: boolean;
}

/** Input of listing lifecycle transitions. */
export interface ListingLifecycleInput {
  readonly asTenant: TenantId;
  readonly listingId: string;
}

/** Input of {@link import('./host').MarketplaceHost.publishListingVersion}. */
export interface PublishListingVersionInput {
  readonly asTenant: TenantId;
  readonly listingId: string;
  /** Semver core; must be GREATER than the published head. */
  readonly version: string;
  /** Producer-supplied publication instant. */
  readonly publishedAt: string;
}

/** Receipt of publication (the sealed immutable version). */
export interface PublicationReceipt {
  readonly schemaVersion: 1;
  readonly listingId: string;
  readonly version: string;
  readonly contentDigest: string;
  readonly previousVersionDigest: string | null;
  readonly chainLength: number;
  readonly duplicate: boolean;
}

/** Input of draft updates. */
export interface UpdateDraftInput {
  readonly asTenant: TenantId;
  readonly listingId: string;
  readonly draft: ListingDraftInput;
}

/** Input of version reads. */
export interface ListingVersionInput {
  readonly asTenant: TenantId;
  readonly listingId: string;
  /** Exact version pin (either the version or the digest must be given). */
  readonly version?: string | undefined;
  readonly contentDigest?: string | undefined;
}

/** Input of the catalog listing read. */
export interface ListListingsInput {
  readonly asTenant: TenantId;
}

/** One listing catalog entry (deterministic projection). */
export interface ListingSnapshot {
  readonly schemaVersion: 1;
  readonly listingId: string;
  readonly developerTenantId: string;
  readonly lifecycle: ListingLifecycleState;
  readonly visibility: ListingVisibility;
  readonly displayName: string;
  readonly publishedVersionCount: number;
  readonly headVersion: string | null;
  readonly headDigest: string | null;
}

/** The typed chain summary projected by the host. */
export type ListingChainSummary = {
  readonly schemaVersion: 1;
  readonly listingId: string;
  readonly versionCount: number;
  readonly headVersion: string;
  readonly headDigest: string;
};

/** Input of {@link import('./host').MarketplaceHost.grantEntitlement}. */
export interface GrantEntitlementInput {
  /** The ACQUIRING tenant the entitlement is scoped to. */
  readonly asTenant: TenantId;
  readonly idempotencyKey: IdempotencyKey;
  readonly listingId: string;
  /** Exact published version digest (defaults to the listing head). */
  readonly listingVersionDigest?: string | undefined;
  readonly scope: EntitlementScope;
  readonly seats?: number | undefined;
  readonly grantedAt: string;
  readonly grantedBy: PrincipalId;
}

/** Input of {@link import('./host').MarketplaceHost.revokeEntitlement}. */
export interface RevokeEntitlementInput {
  readonly asTenant: TenantId;
  readonly entitlementId: string;
  readonly revokedAt: string;
  readonly revokedBy: PrincipalId;
  readonly reason?: string | undefined;
}

/** Input of {@link import('./host').MarketplaceHost.checkEntitlement}. */
export interface CheckEntitlementInput {
  readonly asTenant: TenantId;
  readonly listingId: string;
  readonly workspaceId?: string | undefined;
}

/** Input of {@link import('./host').MarketplaceHost.syncEntitlementFromPayment}. */
export interface SyncEntitlementInput {
  readonly asTenant: TenantId;
  readonly idempotencyKey: IdempotencyKey;
  readonly listingId: string;
  readonly listingVersionDigest?: string | undefined;
  readonly portId: string;
  readonly scope: EntitlementScope;
  readonly seats?: number | undefined;
  readonly grantedAt: string;
  readonly grantedBy: PrincipalId;
}

/** Input of the payment check passthrough. */
export interface HostPaymentCheckInput {
  readonly asTenant: TenantId;
  readonly listingId: string;
  readonly listingVersionDigest?: string | undefined;
  readonly portId: string;
}

/** Grant receipt (idempotent). */
export interface EntitlementGrantReceipt {
  readonly schemaVersion: 1;
  readonly entitlement: EntitlementGrantRecord;
  readonly duplicate: boolean;
}

/** Revocation receipt (idempotent). */
export interface EntitlementRevokeReceipt {
  readonly schemaVersion: 1;
  readonly revocation: EntitlementRevokeRecord;
  readonly duplicate: boolean;
}

/** The positive entitlement evaluation result (kernel projection). */
export type EntitlementEvaluation = EntitlementCheckPositive;

/** Input of {@link import('./host').MarketplaceHost.recordUsage}. */
export interface RecordUsageInput {
  readonly asTenant: TenantId;
  readonly entitlementId: string;
  readonly idempotencyKey: IdempotencyKey;
  readonly units: string;
  readonly unitName?: string | undefined;
  /** Producer-supplied metering instant. */
  readonly meteredAt: string;
  readonly actor: PrincipalId;
}

/** Usage intake receipt (idempotent, duplicate-suppressed). */
export interface UsageRecordReceipt {
  readonly schemaVersion: 1;
  readonly entitlementId: string;
  readonly streamId: string;
  readonly sequence: number;
  readonly contentDigest: string;
  readonly duplicate: boolean;
}

/** Input of the usage account read. */
export interface UsageAccountInput {
  readonly asTenant: TenantId;
  readonly entitlementId: string;
}

/** The usage account projection (kernel fold result). */
export type UsageAccountProjection = UsageAccount;

/** Input of {@link import('./host').MarketplaceHost.recordRevenue}. */
export interface RecordRevenueInput {
  /** The DEVELOPER tenant the revenue accrues to. */
  readonly asTenant: TenantId;
  readonly idempotencyKey: IdempotencyKey;
  readonly acquiringTenantId: TenantId;
  readonly listingId: string;
  readonly listingVersionDigest: string;
  readonly entitlementId?: string | undefined;
  readonly basis: 'one-time' | 'subscription' | 'seat' | 'usage';
  readonly amount: string;
  readonly currency: string;
  readonly recordedAt: string;
  readonly recordedBy: PrincipalId;
  readonly provenance: RevenueProvenance;
}

/** Revenue intake receipt (idempotent). */
export interface RevenueRecordReceipt {
  readonly schemaVersion: 1;
  readonly record: RevenueRecord;
  readonly duplicate: boolean;
}

/** Input of the revenue ledger read. */
export interface ListRevenueInput {
  readonly asTenant: TenantId;
}

/** Health/liveness as typed data (pure state projection). */
export interface HealthReport {
  readonly schemaVersion: 1;
  readonly service: string;
  readonly status: 'ready';
  readonly listingCount: number;
  readonly listingsByLifecycle: Readonly<Record<ListingLifecycleState, number>>;
  readonly publishedVersionCount: number;
  readonly entitlementCount: number;
  readonly activeEntitlementCount: number;
  readonly revokedEntitlementCount: number;
  readonly usageEventCount: number;
  readonly revenueRecordCount: number;
  readonly registeredPortCount: number;
}

/** The typed service surface description. */
export interface ServiceDescription {
  readonly schemaVersion: 1;
  readonly service: string;
  readonly contractVersion: string;
  readonly lifecycle: readonly string[];
  readonly invariants: readonly string[];
}

/** Re-exported kernel types consumed by host callers. */
export type {
  MarketplaceError,
  PaymentCheckOutcome,
  SealedListingVersion,
  SealedUsageEvent,
  UsageEventData,
};
