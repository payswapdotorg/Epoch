/**
 * Epoch Developer Portal v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `services/developer-portal/contracts` ownership boundary (Work Order
 * W025, the W012 declaration-only convention: index.d.ts + manifest.json
 * + parity.ts + schemas/, NO package.json). It is self-contained: no
 * imports, no runtime code, no vendor/provider vocabulary. The runtime
 * implementation lives in `@epoch/developer-portal-host` (service layer);
 * `parity.ts` in this directory proves at compile time that the
 * implementation's types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 *
 * Scope (deliberate): the DATA surface crossing the developer-portal
 * boundary — inputs, receipts, projections, the `portal:*` event
 * vocabulary over the W010 event shapes, and the typed error union.
 * Upstream records the portal consumes and re-exposes verbatim (W007
 * capability records, W023 sealed listing versions / entitlement grants /
 * revenue records, W024 billing accounts) stay the owning packages'
 * contracts and are mirrored here ONLY where they cross the boundary as
 * input payloads (draft pricing, capability references, trust evidence,
 * authorization contexts). The host class, its constructor options, and
 * the internal capability browse seam are implementation wiring, not
 * boundary data.
 *
 * Authority (architecture lock rules 8/16): the developer portal is a
 * developer-facing projection and authoring surface over the W007
 * registry and the W023 marketplace kernel — never a second source of
 * truth. Listing versions are the marketplace kernel's records (sealed,
 * immutable, hash-chained); entitlements are the marketplace kernel's
 * records; capability registrations are the registry's records.
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** The closed `portal:*` event discriminator vocabulary (W010 open namespace). */
export type PortalEventDiscriminator =
  | 'portal:listing-created'
  | 'portal:draft-updated'
  | 'portal:listing-submitted'
  | 'portal:version-published'
  | 'portal:listing-retired'
  | 'portal:grant-adopted'
  | 'portal:grant-revoked'
  | 'portal:revenue-adopted'
  | 'portal:billing-account-adopted';

/** Listing lifecycle states (the W023 kernel vocabulary). */
export type ListingLifecycleState = 'draft' | 'submitted' | 'published' | 'retired';

/** Listing visibility (the W023 kernel vocabulary). */
export type ListingVisibility = 'public' | 'private';

/** The closed pricing-model kind vocabulary (the W023 kernel vocabulary). */
export type PricingModelKindInput =
  | 'free'
  | 'one-time'
  | 'subscription'
  | 'seat-workspace'
  | 'usage-metered'
  | 'hybrid'
  | 'enterprise-private';

/** One billing period (the W023 kernel vocabulary). */
export type BillingPeriodInput = 'monthly' | 'annual';

// ---------------------------------------------------------------------------
// Mirrored upstream payload shapes (canonical homes: @epoch/marketplace —
// W023; @epoch/authorization — W009). Field-for-field structural mirrors.
// ---------------------------------------------------------------------------

/** A fixed pricing component (the non-metered, non-hybrid models). */
export type FixedPricingComponentInput =
  | { readonly kind: 'free' }
  | { readonly kind: 'one-time'; readonly amount: string; readonly currency: string }
  | {
      readonly kind: 'subscription';
      readonly recurringAmount: string;
      readonly currency: string;
      readonly billingPeriod: BillingPeriodInput;
    }
  | {
      readonly kind: 'seat-workspace';
      readonly perSeatAmount: string;
      readonly currency: string;
      readonly billingPeriod: BillingPeriodInput;
      readonly minSeats?: number | undefined;
      readonly maxSeats?: number | undefined;
    };

/** A pricing model record (the kernel's PricingModel union, structural). */
export type PricingModelInput =
  | { readonly kind: 'free' }
  | { readonly kind: 'one-time'; readonly amount: string; readonly currency: string }
  | {
      readonly kind: 'subscription';
      readonly recurringAmount: string;
      readonly currency: string;
      readonly billingPeriod: BillingPeriodInput;
    }
  | {
      readonly kind: 'seat-workspace';
      readonly perSeatAmount: string;
      readonly currency: string;
      readonly billingPeriod: BillingPeriodInput;
      readonly minSeats?: number | undefined;
      readonly maxSeats?: number | undefined;
    }
  | {
      readonly kind: 'usage-metered';
      readonly unitAmount: string;
      readonly currency: string;
      readonly unitName: string;
      readonly includedUnits?: string | undefined;
    }
  | {
      readonly kind: 'hybrid';
      readonly fixed: FixedPricingComponentInput;
      readonly metered: Extract<PricingModelInput, { readonly kind: 'usage-metered' }>;
    }
  | {
      readonly kind: 'enterprise-private';
      readonly contactRoute: string;
      readonly audienceTenantIds: string[];
    };

/** A versioned capability reference (the kernel's record, structural). */
export interface CapabilityVersionReferenceInput {
  readonly capabilityId: string;
  readonly version: string;
}

/** Directional bias for interval confidence estimates (the W006 vocabulary). */
export type TrustIntervalBiasInput = 'none' | 'low' | 'high';

/** Confidence acquisition method (the W006 vocabulary). */
export type TrustConfidenceMethodInput = 'stated' | 'measured' | 'estimated' | 'derived' | 'imported';

/** Trust-evidence kind (the W006 vocabulary). */
export type TrustEvidenceKindInput =
  | 'document'
  | 'measurement'
  | 'observation'
  | 'computation'
  | 'assertion'
  | 'external'
  | 'other';

/** One confidence distribution (the W006 shape, structural). */
export type TrustConfidenceDistributionInput =
  | { readonly kind: 'point'; readonly value: number }
  | {
      readonly kind: 'interval';
      readonly lower: number;
      readonly upper: number;
      readonly bias?: TrustIntervalBiasInput | undefined;
    }
  | {
      readonly kind: 'set';
      readonly values: readonly number[];
      readonly weights?: readonly number[] | undefined;
    };

/** Confidence attached to a trust-evidence record (the W006 shape, structural). */
export interface TrustConfidenceInput {
  readonly distribution: TrustConfidenceDistributionInput;
  readonly method?: TrustConfidenceMethodInput | undefined;
  readonly rationale?: string | undefined;
}

/** Exact-revision subject reference (the W006 shape, structural). */
export interface TrustExactRevisionRefInput {
  readonly artifactId: string;
  readonly revision: string;
  readonly digest: string;
}

/** Production provenance (the W006 shape, structural). */
export interface TrustEvidenceProductionInput {
  readonly runId: string;
  readonly actorId: string;
  readonly methodId?: string | undefined;
}

/** Media-typed payload (the W006 shape, structural). */
export interface TrustEvidencePayloadInput {
  readonly mediaType: string;
  readonly data: PortalJsonData;
  readonly locator?: string | undefined;
}

/** One W006-shaped trust-evidence record (structural). */
export interface TrustEvidenceRecordInput {
  readonly schemaVersion: 1;
  readonly kind: TrustEvidenceKindInput;
  readonly subject: TrustExactRevisionRefInput;
  readonly producedBy: TrustEvidenceProductionInput;
  readonly observedAt: string;
  readonly content: TrustEvidencePayloadInput;
  readonly confidence: TrustConfidenceInput;
}

/** One W009 principal fact (structural mirror). */
export interface PrincipalFactInput {
  readonly principalId: string;
  readonly status: 'active' | 'suspended' | 'deactivated';
  readonly authenticated: boolean;
}

/** One W009 membership fact (structural mirror). */
export interface MembershipFactInput {
  readonly principalId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

/** The W009 authorization context (structural mirror). */
export interface AuthorizationContextInput {
  readonly schemaVersion: 1;
  readonly principals: readonly PrincipalFactInput[];
  readonly memberships: readonly MembershipFactInput[];
  readonly knownTenants: readonly string[];
}

/** The caller-supplied authorization input (W009 decision facts). */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContextInput;
  readonly justification?: string | undefined;
}

// ---------------------------------------------------------------------------
// Listing authoring + publication inputs.
// ---------------------------------------------------------------------------

/** The draft fields of a listing (mutable until published). */
export interface ListingDraftInput {
  readonly displayName: string;
  readonly description?: string | undefined;
  readonly capabilityReferences: readonly CapabilityVersionReferenceInput[];
  readonly pricing: PricingModelInput;
  readonly trustEvidence: readonly TrustEvidenceRecordInput[];
  readonly visibility: ListingVisibility;
  readonly privateAllowList?: readonly string[] | undefined;
}

/** Input of listing-draft creation (idempotent by (key, tenant)). */
export interface CreateListingDraftInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly idempotencyKey: string;
  readonly draft: ListingDraftInput;
  readonly createdAt: string;
}

/** Input of draft updates. */
export interface UpdateListingDraftInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  readonly draft: ListingDraftInput;
  readonly updatedAt: string;
}

/** The shared tenant-scoped listing operation input. */
export interface ListingOperationInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
}

/** Input of listing submission (draft -> submitted). */
export interface SubmitListingInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  readonly submittedAt: string;
}

/** Input of listing retirement (published -> retired). */
export interface RetireListingInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  readonly retiredAt: string;
}

/** Input of listing-version publication. */
export interface PublishListingVersionInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  readonly version: string;
  readonly publishedAt: string;
}

/** Input of a published-version read. */
export interface ListingVersionReadInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  readonly version?: string | undefined;
  readonly contentDigest?: string | undefined;
}

/** Input of the developer's listing list read. */
export interface ListListingsInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
}

// ---------------------------------------------------------------------------
// Capability browse inputs.
// ---------------------------------------------------------------------------

/** The Capability Fabric categories (the W007 vocabulary, structural). */
export type CapabilityCategoryInput =
  | 'source'
  | 'semantic'
  | 'reconstruction'
  | 'visualization'
  | 'simulation'
  | 'evaluator'
  | 'action'
  | 'verification';

/** The capability lifecycle states (the W007 vocabulary, structural). */
export type CapabilityLifecycleStateInput = 'registered' | 'deprecated' | 'retired';

/** A version constraint (the W007 semver vocabulary, structural). */
export type VersionConstraintInput =
  | { readonly kind: 'exact'; readonly version: string }
  | { readonly kind: 'caret'; readonly version: string };

/** Input of capability browsing (deterministic, filtered, read-only). */
export interface BrowseCapabilitiesInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly category?: CapabilityCategoryInput | undefined;
  readonly lifecycle?: CapabilityLifecycleStateInput | undefined;
}

/** Input of version-constrained capability resolution. */
export interface ResolveCapabilityInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly capabilityId: string;
  readonly constraint: VersionConstraintInput;
}

// ---------------------------------------------------------------------------
// Developer analytics adoption inputs.
// ---------------------------------------------------------------------------

/** Input of W023 entitlement grant adoption. */
export interface AdoptGrantInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly grant: unknown;
}

/** Input of W023 entitlement revocation adoption. */
export interface AdoptRevocationInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly revocation: unknown;
}

/** Input of W023 developer revenue record adoption. */
export interface AdoptRevenueInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly record: unknown;
}

/** Input of W024 sealed billing account adoption. */
export interface AdoptBillingAccountInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly account: unknown;
}

/** Input of the developer dashboard read. */
export interface DashboardInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
}

/** Input of the event-stream read. */
export interface StreamReadInput {
  readonly asTenant: string;
  readonly authorization: AuthorizationInput;
  readonly streamId: string;
}

// ---------------------------------------------------------------------------
// Host records — receipts and projections.
// ---------------------------------------------------------------------------

/** Receipt of listing-draft creation / update (idempotent). */
export interface ListingCreationReceipt {
  readonly schemaVersion: 1;
  readonly listingId: string;
  readonly lifecycle: ListingLifecycleState;
  readonly draftDigest: string;
  readonly duplicate: boolean;
}

/** Receipt of listing-version publication (the sealed immutable version). */
export interface PublicationReceipt {
  readonly schemaVersion: 1;
  readonly listingId: string;
  readonly version: string;
  readonly contentDigest: string;
  readonly previousVersionDigest: string | null;
  readonly chainLength: number;
  readonly duplicate: boolean;
}

/** The adopted record kinds (the developer analytics vocabulary). */
export type AdoptionReceiptRecordKind =
  | 'entitlement-grant'
  | 'entitlement-revocation'
  | 'revenue-record'
  | 'billing-account';

/** Receipt of record adoption (idempotent by record identity). */
export interface AdoptionReceipt {
  readonly schemaVersion: 1;
  readonly recordId: string;
  readonly recordKind: AdoptionReceiptRecordKind;
  readonly duplicate: boolean;
}

/** One developer-owned listing snapshot (deterministic projection). */
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

/** The verified publication-chain summary of one listing. */
export interface ChainSummary {
  readonly schemaVersion: 1;
  readonly listingId: string;
  readonly versionCount: number;
  readonly headVersion: string;
  readonly headDigest: string;
}

/** The developer's adopted payout (billing) account summary. */
export interface PayoutAccountSummary {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly currency: string;
  readonly displayName: string;
  readonly openedAt: string;
  readonly contentDigest: string;
}

/** The developer dashboard (pure deterministic state projection). */
export interface DeveloperDashboard {
  readonly schemaVersion: 1;
  readonly developerTenantId: string;
  readonly listingCount: number;
  readonly listingsByLifecycle: Readonly<Record<string, number>>;
  readonly publishedVersionCount: number;
  readonly adoptedGrantCount: number;
  readonly activeEntitlementCount: number;
  readonly revokedEntitlementCount: number;
  readonly revenueRecordCount: number;
  readonly revenueByCurrency: Readonly<Record<string, string>>;
  readonly payoutAccount: PayoutAccountSummary | null;
  readonly registeredCapabilityCount: number;
  readonly eventCount: number;
}

/** Health/liveness as typed data (pure state projection). */
export interface HealthReport {
  readonly schemaVersion: 1;
  readonly service: 'epoch.developer-portal-host';
  readonly status: 'ready';
  readonly listingCount: number;
  readonly listingsByLifecycle: Readonly<Record<string, number>>;
  readonly publishedVersionCount: number;
  readonly adoptedGrantCount: number;
  readonly adoptedRevocationCount: number;
  readonly adoptedRevenueCount: number;
  readonly adoptedBillingAccountCount: number;
  readonly registrySize: number;
  readonly eventCount: number;
}

/** The typed service surface description. */
export interface ServiceDescription {
  readonly schemaVersion: 1;
  readonly service: 'epoch.developer-portal-host';
  readonly contractVersion: string;
  readonly operations: readonly string[];
  readonly invariants: readonly string[];
}

// ---------------------------------------------------------------------------
// The portal event vocabulary over the W010 event shapes.
// ---------------------------------------------------------------------------

/** One portal event sequence number (1-based, contiguous per stream). */
export type PortalEventSequence = number;

/** The causal parent reference of an event (strictly earlier in-stream). */
export interface PortalCausalParent {
  readonly streamId: string;
  readonly sequence: PortalEventSequence;
}

/** JSON-representable data (the W010/W003 shared shape, structural). */
export type PortalJsonData =
  | null
  | boolean
  | number
  | string
  | PortalJsonData[]
  | { [key: string]: PortalJsonData };

/** The typed payload of a portal event (the W010 shape — the discriminator
 * is an open string; the closed `portal:*` vocabulary is enforced at
 * runtime by `sealPortalEvent`/`parsePortalEventData`). */
export interface PortalEventPayload {
  readonly discriminator: string;
  readonly data: Readonly<Record<string, PortalJsonData>>;
}

/** The immutable content of one portal event (the W010 EventContent shape). */
export interface PortalEventContent {
  readonly schemaVersion: 1;
  readonly streamId: string;
  readonly sequence: PortalEventSequence;
  readonly tenantId: string;
  readonly actor: string;
  readonly causalParent: PortalCausalParent | null;
  readonly payload: PortalEventPayload;
  readonly occurredAt: string;
}

/** The SEALED portal event record: content plus its SHA-256 content digest. */
export interface SealedPortalEvent extends PortalEventContent {
  readonly contentDigest: string;
}

/** Payload data of `portal:listing-created`. */
export interface ListingCreatedData {
  readonly listingId: string;
  readonly draftDigest: string;
  readonly displayName: string;
}

/** Payload data of `portal:draft-updated`. */
export interface DraftUpdatedData {
  readonly listingId: string;
  readonly draftDigest: string;
}

/** Payload data of `portal:listing-submitted`. */
export interface ListingSubmittedData {
  readonly listingId: string;
}

/** Payload data of `portal:version-published`. */
export interface VersionPublishedData {
  readonly listingId: string;
  readonly version: string;
  readonly contentDigest: string;
  readonly previousVersionDigest: string | null;
  readonly chainLength: number;
}

/** Payload data of `portal:listing-retired`. */
export interface ListingRetiredData {
  readonly listingId: string;
}

/** Payload data of `portal:grant-adopted`. */
export interface GrantAdoptedData {
  readonly entitlementId: string;
  readonly listingId: string;
  readonly acquiringTenantId: string;
}

/** Payload data of `portal:grant-revoked`. */
export interface GrantRevokedData {
  readonly entitlementId: string;
  readonly listingId: string;
}

/** Payload data of `portal:revenue-adopted`. */
export interface RevenueAdoptedData {
  readonly revenueId: string;
  readonly listingId: string;
  readonly amount: string;
  readonly currency: string;
}

/** Payload data of `portal:billing-account-adopted`. */
export interface BillingAccountAdoptedData {
  readonly accountId: string;
  readonly accountDigest: string;
  readonly currency: string;
}

// ---------------------------------------------------------------------------
// The typed error union (the W023 kernel carrier codes + the service codes).
// ---------------------------------------------------------------------------

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface MarketplaceIssueInput {
  readonly path: string;
  readonly message: string;
}

/** The query echo carried by entitlement denials (never a payment echo). */
export interface EntitlementQueryEchoInput {
  readonly listingId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
}

/**
 * The typed Developer Portal error union: the W023 kernel codes (this host
 * constructs kernel carriers; the taxonomy stays the kernel's) plus the
 * service-owned codes (`authorization-rejected`, fail-closed W009 denials;
 * `tenant-isolation-rejected`, the R12 single-tenant guard).
 */
export type DeveloperPortalErrorInput =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly MarketplaceIssueInput[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly MarketplaceIssueInput[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'unknown-listing-reference';
      readonly message: string;
      readonly listingId: string;
    }
  | {
      readonly code: 'unknown-capability-reference';
      readonly message: string;
      readonly capabilityId: string;
      readonly version: string;
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'unknown-entitlement';
      readonly message: string;
      readonly entitlementId: string;
    }
  | {
      readonly code: 'version-not-published';
      readonly message: string;
      readonly listingId: string;
      readonly encounteredVersion?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'version-conflict';
      readonly message: string;
      readonly listingId: string;
      readonly version: string;
      readonly publishedDigest?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly listingId: string;
      readonly from: ListingLifecycleState;
      readonly to: ListingLifecycleState;
    }
  | {
      readonly code: 'entitlement-denied';
      readonly message: string;
      readonly query: EntitlementQueryEchoInput;
    }
  | {
      readonly code: 'entitlement-revoked';
      readonly message: string;
      readonly entitlementId: string;
      readonly revokedAt: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | {
      readonly code: 'payment-port-unavailable';
      readonly message: string;
      readonly portId?: string | undefined;
    }
  | {
      readonly code: 'invalid-pricing-model';
      readonly message: string;
      readonly issues: readonly MarketplaceIssueInput[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'idempotency-conflict';
      readonly message: string;
      readonly idempotencyKey: string;
      readonly boundDigest: string;
      readonly encounteredDigest: string;
    }
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      readonly denialCode: string;
      readonly principalId: string;
      readonly operation: string;
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    };
