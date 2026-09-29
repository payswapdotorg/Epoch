/**
 * Developer Portal feature contracts — the typed VIEW-MODEL surface of
 * the developers feature module (W025).
 *
 * Design constraint (binding): this module lives inside `apps/web` whose
 * manifest is FROZEN to this Work Order (apps/web/package.json is W014's
 * surface), so it cannot declare `@epoch/developer-portal-host` (or any
 * @epoch package) as a dependency and cannot import it. Instead, the
 * record-facing input types below are STRUCTURAL MIRRORS of the exact
 * service public-surface subset this feature consumes (the
 * `services/developer-portal/contracts` declaration tree and the host's
 * projections): TypeScript structural typing means the service records
 * are assignable to these interfaces as-is the moment W014 wires the
 * feature (see README.md for the wiring contract and the field-by-field
 * mapping).
 *
 * View models are presentation-only records (label-ready strings, sorted
 * collections) — never kernel/service semantics (architecture lock rule
 * 8: the experience layer is a projection, never a second source of
 * truth).
 */

// ---------------------------------------------------------------------------
// Input contracts — structural mirrors of the developer-portal host
// surface (field names and shapes match the service records exactly).
// ---------------------------------------------------------------------------

/** Listing lifecycle states (the W023 kernel vocabulary). */
export type ListingLifecycleInput = 'draft' | 'submitted' | 'published' | 'retired';

/** Listing visibility (the W023 kernel vocabulary). */
export type ListingVisibilityInput = 'public' | 'private';

/** The Capability Fabric categories (the W007 vocabulary). */
export type CapabilityCategoryInput =
  | 'source'
  | 'semantic'
  | 'reconstruction'
  | 'visualization'
  | 'simulation'
  | 'evaluator'
  | 'action'
  | 'verification';

/** The capability lifecycle states (the W007 vocabulary). */
export type CapabilityLifecycleInput = 'registered' | 'deprecated' | 'retired';

/** One capability browse record (the W007 registry record, structural). */
export interface CapabilityRecordInput {
  readonly schemaVersion: 1;
  readonly manifest: {
    readonly capabilityId: string;
    readonly category: CapabilityCategoryInput;
    readonly version: string;
    readonly descriptor: {
      readonly displayName: string;
      readonly description?: string | undefined;
    };
  };
  readonly lifecycle: CapabilityLifecycleInput;
  readonly manifestDigest: string;
}

/** One developer-owned listing snapshot (the host projection, structural). */
export interface ListingSnapshotInput {
  readonly schemaVersion: 1;
  readonly listingId: string;
  readonly developerTenantId: string;
  readonly lifecycle: ListingLifecycleInput;
  readonly visibility: ListingVisibilityInput;
  readonly displayName: string;
  readonly publishedVersionCount: number;
  readonly headVersion: string | null;
  readonly headDigest: string | null;
}

/** One published listing version record (the W023 kernel envelope, structural). */
export interface SealedListingVersionInput {
  readonly listingId: string;
  readonly version: string;
  readonly developerTenantId: string;
  readonly displayName: string;
  readonly capabilityReferences: readonly { capabilityId: string; version: string }[];
  readonly visibility: ListingVisibilityInput;
  readonly publishedAt: string;
  readonly contentDigest: string;
  readonly previousVersionDigest: string | null;
}

/** One adopted entitlement grant (the W023 record, structural). */
export interface EntitlementGrantInput {
  readonly entitlementId: string;
  readonly tenantId: string;
  readonly listingId: string;
  readonly listingVersionDigest: string;
  readonly scope: { readonly kind: 'tenant' } | { readonly kind: 'workspace'; readonly workspaceId: string };
  readonly seats?: number | undefined;
  readonly grantedAt: string;
  readonly grantedBy: string;
}

/** The adoption status of one grant (derived through the real check). */
export type EntitlementAdoptionStatus = 'active' | 'revoked';

/** One adopted entitlement grant with its derived status. */
export interface EntitlementAdoptionInput extends EntitlementGrantInput {
  readonly status: EntitlementAdoptionStatus;
}

/** One developer revenue record (the W023 record, structural). */
export interface RevenueRecordInput {
  readonly revenueId: string;
  readonly developerTenantId: string;
  readonly acquiringTenantId: string;
  readonly listingId: string;
  readonly basis: string;
  readonly amount: string;
  readonly currency: string;
  readonly recordedAt: string;
}

/** The adopted payout account summary (the host projection, structural). */
export interface PayoutAccountInput {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly currency: string;
  readonly displayName: string;
  readonly openedAt: string;
  readonly contentDigest: string;
}

/** One sealed portal event (the W010-shaped record, structural). */
export interface PortalEventInput {
  readonly sequence: number;
  readonly tenantId: string;
  readonly actor: string;
  readonly payload: { readonly discriminator: string; readonly data: Readonly<Record<string, unknown>> };
  readonly occurredAt: string;
  readonly contentDigest: string;
}

/** A typed developer-portal error (the service taxonomy, structural). */
export interface DeveloperPortalErrorInput {
  readonly code: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// View models — presentation-only projections.
// ---------------------------------------------------------------------------

/** A display-ready developer listing row. */
export interface DeveloperListingViewModel {
  readonly listingId: string;
  readonly displayName: string;
  readonly lifecycle: ListingLifecycleInput;
  readonly visibility: ListingVisibilityInput;
  readonly publishedVersionCount: number;
  readonly headVersion: string | null;
}

/** A display-ready published version card. */
export interface ListingVersionViewModel {
  readonly listingId: string;
  readonly version: string;
  readonly displayName: string;
  readonly publishedAt: string;
  readonly contentDigest: string;
  readonly capabilityCount: number;
  readonly visibility: ListingVisibilityInput;
  readonly chainLabel: string;
}

/** A display-ready capability browse row. */
export interface CapabilityRowViewModel {
  readonly capabilityId: string;
  readonly version: string;
  readonly category: CapabilityCategoryInput;
  readonly lifecycle: CapabilityLifecycleInput;
  readonly displayName: string;
  readonly manifestDigest: string;
}

/** A display-ready entitlement adoption row. */
export interface EntitlementAdoptionViewModel {
  readonly entitlementId: string;
  readonly listingId: string;
  readonly acquiringTenantId: string;
  readonly scopeLabel: string;
  readonly seatsLabel: string | null;
  readonly grantedAt: string;
  readonly status: EntitlementAdoptionStatus;
}

/** A display-ready revenue ledger entry. */
export interface RevenueEntryViewModel {
  readonly revenueId: string;
  readonly acquiringTenantId: string;
  readonly listingId: string;
  readonly basis: string;
  readonly amountLabel: string;
  readonly recordedAt: string;
}

/** A display-ready payout account card. */
export interface PayoutAccountViewModel {
  readonly accountId: string;
  readonly displayName: string;
  readonly currencyLabel: string;
  readonly openedAt: string;
  readonly contentDigest: string;
}

/** A display-ready portal event feed row. */
export interface PortalEventRowViewModel {
  readonly sequence: number;
  readonly discriminatorLabel: string;
  readonly actor: string;
  readonly occurredAt: string;
}

/** A display-ready error notice. */
export interface DeveloperPortalErrorViewModel {
  readonly code: string;
  readonly message: string;
}
