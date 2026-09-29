/**
 * The Developer Portal host's typed input/output surface (the W028/W024
 * host-pattern: plain JSON records, total results, zero clock reads —
 * every instant is caller-supplied payload data).
 */
import type { AuthorizationContext } from '@epoch/authorization';
import type {
  CapabilityCategory,
  CapabilityLifecycleState,
  CapabilityRecord,
  RegistryResult,
  VersionConstraint,
} from '@epoch/capability-registry';
import type {
  CapabilityVersionReference,
  ListingLifecycleState,
  ListingVisibility,
  MarketplaceError,
  PricingModel,
  TrustEvidenceRecord,
} from '@epoch/marketplace';
import type { SealedBillingAccount } from '@epoch/entitlements';
import type {
  AdoptionReceipt,
  ChainSummary,
  DeveloperDashboard,
  HealthReport,
  ListingCreationReceipt,
  ListingSnapshot,
  PayoutAccountSummary,
  PublicationReceipt,
  ServiceDescription,
} from './projections';
import type { SealedPortalEvent } from './events';

/** Idempotency key (opaque, bounded). */
export type IdempotencyKey = string;

/** Tenant id (the W009 grammar). */
export type TenantId = string;

/** Principal id (the W009 identity grammar). */
export type PrincipalId = string;

/** The typed host result: a value or a kernel/service-typed error. */
export type HostResult<T> = DeveloperPortalResult<T>;

/** Total-result wrapper of every service entry point. */
export type DeveloperPortalResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DeveloperPortalError };

/** The caller-supplied authorization context (W009 decision facts). */
export type { AuthorizationContext };

/** The caller-supplied authorization input (principal + context + justification). */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContext;
  readonly justification?: string | undefined;
}

/**
 * The typed service-error union: the W023 kernel codes (validation,
 * version/lifecycle conflicts, tenant isolation, digest mismatches,
 * idempotency conflicts, entitlement denials — this host constructs kernel
 * carriers, never redefines the taxonomy) plus the service-owned codes.
 */
export type DeveloperPortalError =
  | MarketplaceError
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

// --------------------------------------------------------------------------------
// The capability browse seam (W007 — the registry stays the authority).
// --------------------------------------------------------------------------------

/**
 * The structural browse seam this host needs from the W007 registry.
 * `CapabilityRegistry` satisfies it structurally — the registry is the
 * authority; the portal never recreates it (and never mutates it:
 * browsing and resolution only).
 */
export interface CapabilityBrowseSurface {
  /** Deterministic listing (sorted by capability id, then version). */
  list(filter?: {
    readonly category?: CapabilityCategory | undefined;
    readonly lifecycle?: CapabilityLifecycleState | undefined;
  }): readonly CapabilityRecord[];
  /** Exact (id, version) pin. */
  get(lookup: { readonly capabilityId: string; readonly version: string }): RegistryResult<CapabilityRecord>;
  /** Version-constrained resolution for new bindings (retired never resolve). */
  resolve(input: {
    readonly capabilityId: string;
    readonly constraint: VersionConstraint;
  }): RegistryResult<CapabilityRecord>;
  /** Number of registered records (all lifecycle states). */
  readonly size: number;
}

// --------------------------------------------------------------------------------
// Options.
// --------------------------------------------------------------------------------

/** Options of the {@link import('./host').DeveloperPortalHost} constructor. */
export interface DeveloperPortalHostOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
  /**
   * The W007 capability browse surface listing references resolve and
   * browse against (defaults to a fresh private `CapabilityRegistry`).
   * Real W007 consumption; the portal never recreates the registry's
   * authority and never mutates it.
   */
  readonly registry?: CapabilityBrowseSurface | undefined;
}

// --------------------------------------------------------------------------------
// Listing authoring + publication inputs.
// --------------------------------------------------------------------------------

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

/** Input of {@link import('./host').DeveloperPortalHost.createListingDraft}. */
export interface CreateListingDraftInput {
  /** The developer tenant the listing belongs to. */
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  /** Idempotency key: same (key, tenant) re-derives the same listing id. */
  readonly idempotencyKey: IdempotencyKey;
  readonly draft: ListingDraftInput;
  /** Producer-supplied creation instant. */
  readonly createdAt: string;
}

/** Input of {@link import('./host').DeveloperPortalHost.updateListingDraft}. */
export interface UpdateListingDraftInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  readonly draft: ListingDraftInput;
  /** Producer-supplied update instant. */
  readonly updatedAt: string;
}

/** The shared tenant-scoped listing input (lifecycle transitions + reads). */
export interface ListingOperationInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
}

/** Input of {@link import('./host').DeveloperPortalHost.submitListing}. */
export interface SubmitListingInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  /** Producer-supplied submission instant. */
  readonly submittedAt: string;
}

/** Input of {@link import('./host').DeveloperPortalHost.retireListing}. */
export interface RetireListingInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  /** Producer-supplied retirement instant. */
  readonly retiredAt: string;
}

/** Input of {@link import('./host').DeveloperPortalHost.publishListingVersion}. */
export interface PublishListingVersionInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  /** Semver core; must be GREATER than the published head. */
  readonly version: string;
  /** Producer-supplied publication instant. */
  readonly publishedAt: string;
}

/** Input of a published-version read. */
export interface ListingVersionReadInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  /** Exact version pin (either the version or the digest must be given). */
  readonly version?: string | undefined;
  readonly contentDigest?: string | undefined;
}

/** Input of the developer's listing list read. */
export interface ListListingsInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
}

// --------------------------------------------------------------------------------
// Capability browse inputs.
// --------------------------------------------------------------------------------

/** Input of {@link import('./host').DeveloperPortalHost.browseCapabilities}. */
export interface BrowseCapabilitiesInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly category?: CapabilityCategory | undefined;
  readonly lifecycle?: CapabilityLifecycleState | undefined;
}

/** Input of {@link import('./host').DeveloperPortalHost.resolveCapability}. */
export interface ResolveCapabilityInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly capabilityId: string;
  readonly constraint: VersionConstraint;
}

// --------------------------------------------------------------------------------
// Developer analytics adoption inputs.
// --------------------------------------------------------------------------------

/** Input of {@link import('./host').DeveloperPortalHost.adoptEntitlementGrant}. */
export interface AdoptGrantInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  /** A W023 entitlement grant record (validated through the REAL parser). */
  readonly grant: unknown;
}

/** Input of {@link import('./host').DeveloperPortalHost.adoptEntitlementRevocation}. */
export interface AdoptRevocationInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  /** A W023 entitlement revocation record (validated through the REAL parser). */
  readonly revocation: unknown;
}

/** Input of {@link import('./host').DeveloperPortalHost.adoptRevenueRecord}. */
export interface AdoptRevenueInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  /** A W023 developer revenue record (validated through the REAL validator). */
  readonly record: unknown;
}

/** Input of {@link import('./host').DeveloperPortalHost.adoptBillingAccount}. */
export interface AdoptBillingAccountInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  /** A sealed W024 billing account (verified through the REAL verifier). */
  readonly account: unknown;
}

/** Input of the developer dashboard read. */
export interface DashboardInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
}

/** Input of the event-stream read. */
export interface StreamReadInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly streamId: string;
}

// --------------------------------------------------------------------------------
// Re-exported upstream record types consumed by host callers.
// --------------------------------------------------------------------------------

export type {
  AdoptionReceipt,
  ChainSummary,
  DeveloperDashboard,
  HealthReport,
  ListingCreationReceipt,
  ListingSnapshot,
  ListingLifecycleState,
  PayoutAccountSummary,
  PublicationReceipt,
  SealedPortalEvent,
  SealedBillingAccount,
  ServiceDescription,
};
