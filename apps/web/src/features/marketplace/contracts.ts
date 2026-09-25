/**
 * Marketplace feature contracts — the typed VIEW-MODEL surface of the
 * marketplace feature module (W023).
 *
 * Design constraint (binding): this module lives inside `apps/web` whose
 * manifest is FROZEN to this Work Order (apps/web/package.json is W014's
 * surface), so it cannot declare `@epoch/marketplace` as a dependency and
 * therefore cannot import it. Instead, the record-facing input types below
 * are STRUCTURAL MIRRORS of the exact `@epoch/marketplace` public-surface
 * subset this feature consumes (sealed listing versions, entitlement
 * evaluation results, usage accounts, revenue records, pricing models):
 * TypeScript structural typing means the kernel records are assignable to
 * these interfaces as-is the moment W014 wires the feature (see README.md
 * for the wiring contract and the field-by-field mapping).
 *
 * View models are presentation-only records (label-ready strings, sorted
 * collections) — never kernel semantics (architecture lock rule 8: the
 * experience layer is a projection, never a second source of truth).
 */

// ---------------------------------------------------------------------------
// Input contracts — structural mirrors of the @epoch/marketplace surface
// (field names and shapes match the kernel records exactly; see README.md).
// ---------------------------------------------------------------------------

/** Pricing model kinds (the kernel's closed vocabulary). */
export type PricingModelKindInput =
  | 'free'
  | 'one-time'
  | 'subscription'
  | 'seat-workspace'
  | 'usage-metered'
  | 'hybrid'
  | 'enterprise-private';

/** A pricing model record (the kernel's PricingModel union, structural). */
export type PricingModelInput =
  | { readonly kind: 'free' }
  | { readonly kind: 'one-time'; readonly amount: string; readonly currency: string }
  | {
      readonly kind: 'subscription';
      readonly recurringAmount: string;
      readonly currency: string;
      readonly billingPeriod: 'monthly' | 'annual';
    }
  | {
      readonly kind: 'seat-workspace';
      readonly perSeatAmount: string;
      readonly currency: string;
      readonly billingPeriod: 'monthly' | 'annual';
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
      readonly fixed: PricingModelInput;
      readonly metered: Extract<PricingModelInput, { kind: 'usage-metered' }>;
    }
  | {
      readonly kind: 'enterprise-private';
      readonly contactRoute: string;
      readonly audienceTenantIds: readonly string[];
    };

/** Listing lifecycle states (the kernel vocabulary). */
export type ListingLifecycleInput = 'draft' | 'submitted' | 'published' | 'retired';

/** One catalog listing projection (the host's ListingSnapshot, structural). */
export interface ListingSnapshotInput {
  readonly listingId: string;
  readonly developerTenantId: string;
  readonly lifecycle: ListingLifecycleInput;
  readonly visibility: 'public' | 'private';
  readonly displayName: string;
  readonly publishedVersionCount: number;
  readonly headVersion: string | null;
  readonly headDigest: string | null;
}

/** One published listing version record (the kernel's sealed envelope, structural). */
export interface SealedListingVersionInput {
  readonly listingId: string;
  readonly version: string;
  readonly developerTenantId: string;
  readonly displayName: string;
  readonly capabilityReferences: readonly { capabilityId: string; version: string }[];
  readonly pricing: PricingModelInput;
  readonly trustEvidenceCount: number;
  readonly visibility: 'public' | 'private';
  readonly publishedAt: string;
  readonly contentDigest: string;
}

/** The entitlement evaluation result (the kernel check positive, structural). */
export interface EntitlementEvaluationInput {
  readonly entitlement: {
    readonly entitlementId: string;
    readonly tenantId: string;
    readonly listingId: string;
    readonly listingVersionDigest: string;
    readonly scope: { readonly kind: 'tenant' } | { readonly kind: 'workspace'; readonly workspaceId: string };
    readonly seats?: number | undefined;
    readonly grantedAt: string;
    readonly grantedBy: string;
    readonly provenance: { readonly kind: 'direct' } | { readonly kind: 'payment-sync'; readonly portId: string };
  };
  readonly matchedGrantCount: number;
  readonly revokedMatchingCount: number;
}

/** A usage account projection (the kernel fold result, structural). */
export interface UsageAccountInput {
  readonly entitlementId: string;
  readonly tenantId: string;
  readonly listingId: string;
  readonly listingVersionDigest: string;
  readonly streamId: string;
  readonly eventCount: number;
  readonly totalUnits: string;
  readonly firstEventAt?: string | undefined;
  readonly lastEventAt?: string | undefined;
}

/** A developer revenue record (the kernel record, structural). */
export interface RevenueRecordInput {
  readonly revenueId: string;
  readonly developerTenantId: string;
  readonly acquiringTenantId: string;
  readonly listingId: string;
  readonly listingVersionDigest: string;
  readonly basis: 'one-time' | 'subscription' | 'seat' | 'usage';
  readonly amount: string;
  readonly currency: string;
  readonly recordedAt: string;
  readonly provenance: { readonly kind: string };
}

/** A typed marketplace error (the kernel taxonomy, structural). */
export interface MarketplaceErrorInput {
  readonly code: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// View models — presentation-only projections.
// ---------------------------------------------------------------------------

/** A display-ready pricing line. */
export interface PricingLine {
  readonly label: string;
  readonly value: string;
}

/** A display-ready pricing summary. */
export interface PricingSummaryViewModel {
  readonly kind: PricingModelKindInput;
  readonly headline: string;
  readonly lines: readonly PricingLine[];
}

/** A display-ready catalog listing. */
export interface ListingSummaryViewModel {
  readonly listingId: string;
  readonly displayName: string;
  readonly developerTenantId: string;
  readonly lifecycle: ListingLifecycleInput;
  readonly visibility: 'public' | 'private';
  readonly publishedVersionCount: number;
  readonly headVersion: string | null;
  readonly pricingHeadline: string | null;
}

/** A display-ready published version card. */
export interface ListingVersionViewModel {
  readonly listingId: string;
  readonly version: string;
  readonly displayName: string;
  readonly publishedAt: string;
  readonly contentDigest: string;
  readonly capabilityCount: number;
  readonly trustEvidenceCount: number;
  readonly visibility: 'public' | 'private';
}

/** A display-ready entitlement status. */
export interface EntitlementStatusViewModel {
  readonly entitlementId: string;
  readonly listingId: string;
  readonly tenantId: string;
  readonly scopeLabel: string;
  readonly seatsLabel: string | null;
  readonly grantedAt: string;
  readonly grantedBy: string;
  readonly provenanceLabel: string;
  readonly status: 'active';
  readonly revokedRelatedCount: number;
}

/** A display-ready usage summary. */
export interface UsageSummaryViewModel {
  readonly entitlementId: string;
  readonly listingId: string;
  readonly eventCount: number;
  readonly totalUnits: string;
  readonly windowLabel: string | null;
  readonly streamId: string;
}

/** A display-ready revenue ledger entry. */
export interface RevenueEntryViewModel {
  readonly revenueId: string;
  readonly acquiringTenantId: string;
  readonly listingId: string;
  readonly basis: string;
  readonly amountLabel: string;
  readonly recordedAt: string;
  readonly provenanceLabel: string;
}

/** A display-ready error notice. */
export interface MarketplaceErrorViewModel {
  readonly code: string;
  readonly message: string;
}
