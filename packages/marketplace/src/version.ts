/**
 * Marketplace contract versions and the closed vocabularies (W023).
 *
 * architecture.md (binding): "Epoch owns listings, trust metadata, versions,
 * entitlements, usage accounting, and developer revenue records. Payment
 * processors are adapters." extension-architecture.md (binding): "Supports
 * free, one-time, subscription, seat/workspace, usage, hybrid,
 * enterprise/private. Payment processor state is not entitlement authority.
 * Entitlement revocation is immediate at the Epoch capability boundary."
 *
 * Every vocabulary below is CLOSED (a typed union, never an open string) and
 * provider-neutral: no entry names a payment brand, gateway, or API surface.
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry and
 * @epoch/tenancy): a serialized marketplace record is admitted only when its
 * `schemaVersion` equals {@link MARKETPLACE_RECORD_VERSION} exactly; skew
 * surfaces as a `validation` issue at path ["schemaVersion"] before other
 * schema diagnostics. {@link MARKETPLACE_CONTRACT_VERSION} versions the
 * published contract surface (schemas/ + the typed index export).
 */

/** Version of the published marketplace contract surface (schemas/ + types). */
export const MARKETPLACE_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized marketplace record. */
export const MARKETPLACE_RECORD_VERSION = 1 as const;

/**
 * Schema discriminator carried by every serialized listing-version envelope
 * (the W011 sealed-envelope discipline: a literal `schema` names the record
 * family so mixed envelopes cannot be confused at admission).
 */
export const LISTING_VERSION_SCHEMA_NAME = 'epoch.marketplace.listing-version' as const;

/**
 * The listing lifecycle (W023 Tech Lead pin): draft -> submitted ->
 * published; publication seals the immutable version. `retired` withdraws a
 * published listing from the catalog (published versions remain immutable
 * and verifiable — retirement never rewrites history).
 */
export const LISTING_LIFECYCLE_STATES = [
  'draft',
  'submitted',
  'published',
  'retired',
] as const;

/** One listing lifecycle state. */
export type ListingLifecycleState = (typeof LISTING_LIFECYCLE_STATES)[number];

/** The typed legal-successor table of the listing lifecycle. */
export const LISTING_LIFECYCLE_TRANSITIONS: Readonly<
  Record<ListingLifecycleState, readonly ListingLifecycleState[]>
> = {
  draft: ['submitted'],
  submitted: ['published'],
  published: ['retired'],
  retired: [],
};

/**
 * The CLOSED pricing-model vocabulary (extension-architecture.md, binding):
 * free, one-time, subscription, seat/workspace, usage (metered), hybrid,
 * enterprise/private. Pricing models are TYPED DATA ONLY — record shape +
 * validation; there is no monetization logic in this package.
 */
export const PRICING_MODEL_KINDS = [
  'free',
  'one-time',
  'subscription',
  'seat-workspace',
  'usage-metered',
  'hybrid',
  'enterprise-private',
] as const;

/** One pricing-model kind. */
export type PricingModelKind = (typeof PRICING_MODEL_KINDS)[number];

/** Billing periods admitted by subscription and seat/workspace pricing. */
export const BILLING_PERIODS = ['monthly', 'annual'] as const;

/** One billing period. */
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/**
 * Listing visibility: `public` listings appear in every tenant's catalog;
 * `private` (enterprise) listings appear only to the developer tenant and
 * the ids on the private allow-list (R12 tenant isolation).
 */
export const LISTING_VISIBILITIES = ['public', 'private'] as const;

/** One listing visibility. */
export type ListingVisibility = (typeof LISTING_VISIBILITIES)[number];

/**
 * The CLOSED record-shaped results a PaymentPort check may report. The port
 * expresses CHECKS and record-shaped outcomes ONLY — there is no charge,
 * capture, refund-execution, or credential vocabulary anywhere (the port's
 * own in-memory state is primed by its reference test API).
 */
export const PAYMENT_CHECK_RESULTS = [
  'not-required',
  'settled',
  'unpaid',
  'declined',
  'refunded',
  'unknown-charge',
] as const;

/** One payment check result. */
export type PaymentCheckResultKind = (typeof PAYMENT_CHECK_RESULTS)[number];

/**
 * Entitlement provenance vocabulary (architecture lock rule 11): an
 * entitlement is ALWAYS an explicit Epoch-owned record. `direct` grants come
 * from an Epoch-side actor; `payment-sync` grants are PROPOSALS derived from
 * a payment port's check outcome — the grant record is the authority, the
 * payment state never is.
 */
export const ENTITLEMENT_PROVENANCE_KINDS = ['direct', 'payment-sync'] as const;

/** One entitlement provenance kind. */
export type EntitlementProvenanceKind = (typeof ENTITLEMENT_PROVENANCE_KINDS)[number];

/**
 * The revenue-basis vocabulary: which pricing component a developer revenue
 * record accounts for. Record-keeping ONLY — no payout logic.
 */
export const REVENUE_BASIS = ['one-time', 'subscription', 'seat', 'usage'] as const;

/** One revenue basis. */
export type RevenueBasis = (typeof REVENUE_BASIS)[number];

/**
 * The usage-accounting event discriminator (W010 open-namespace payload
 * family): `marketplace:usage` selects the typed metered-usage payload data.
 * The `marketplace` namespace is owned by this package.
 */
export const USAGE_EVENT_DISCRIMINATOR = 'marketplace:usage' as const;

// --------------------------------------------------------------------------------
// Trust-evidence vocabularies — MIRRORED from @epoch/evidence (W006) so
// marketplace trust metadata IS W006-shaped evidence. Pinned by the runtime
// parity test (same fixtures validate through the real W006 validators) and
// the compile-time parity module; never a runtime dependency.
// --------------------------------------------------------------------------------

/** Trust-evidence kind vocabulary — MIRRORED from W006 EVIDENCE_KINDS. */
export const TRUST_EVIDENCE_KINDS = [
  'document',
  'measurement',
  'observation',
  'computation',
  'assertion',
  'external',
  'other',
] as const;

/** Confidence acquisition methods — MIRRORED from W006 CONFIDENCE_METHODS. */
export const CONFIDENCE_METHODS = ['stated', 'measured', 'estimated', 'derived', 'imported'] as const;

/** Interval biases — MIRRORED from W006 INTERVAL_BIASES. */
export const INTERVAL_BIASES = ['none', 'low', 'high'] as const;

// --------------------------------------------------------------------------------
// Opaque, kind-prefixed identity grammars (the W002/W009/W010 house pattern).
// --------------------------------------------------------------------------------

/** Listing identity: `listing:<slug>` (stable across versions). */
export const LISTING_ID_PATTERN = /^listing:[a-z0-9][a-z0-9-]{0,62}$/;

/** Entitlement identity: `entitlement:<slug>`. */
export const ENTITLEMENT_ID_PATTERN = /^entitlement:[a-z0-9][a-z0-9-]{0,62}$/;

/** Entitlement revocation identity: `revocation:<slug>`. */
export const REVOCATION_ID_PATTERN = /^revocation:[a-z0-9][a-z0-9-]{0,62}$/;

/** Developer revenue record identity: `revenue:<slug>`. */
export const REVENUE_ID_PATTERN = /^revenue:[a-z0-9][a-z0-9-]{0,62}$/;

/** Payment port identity: `port:<slug>`. */
export const PAYMENT_PORT_ID_PATTERN = /^port:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Principal identity of the actor named on a marketplace record
 * (`grantedBy`, `revokedBy`, `recordedBy`, usage `actor`). MIRRORED from
 * @epoch/identity's PRINCIPAL_ID_PATTERN (W009 grammar) — pinned by the
 * runtime parity test and the compile-time parity module; never a runtime
 * dependency.
 */
export const MARKETPLACE_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Usage stream identity — MIRRORED from @epoch/event-log's
 * EVENT_STREAM_ID_PATTERN (W010 grammar): `stream:<slug>`. One entitlement's
 * metered usage is one stream; pinned by the runtime parity test.
 */
export const USAGE_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Version discriminator carried by every serialized usage event — MIRRORED
 * from @epoch/event-log's EVENT_LOG_RECORD_VERSION (usage accounting is
 * append-only typed events over the W010 event shapes). The runtime parity
 * test asserts the constants are equal; a future W010 bump intentionally
 * breaks that parity and surfaces here as a review gate.
 */
export const USAGE_EVENT_RECORD_VERSION = 1 as const;

/** The kind prefix of a marketplace opaque id (the segment before `:`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}

/** Derive the usage stream id of one entitlement (deterministic). */
export function usageStreamIdOf(entitlementId: string): string {
  const suffix = entitlementId.slice('entitlement:'.length);
  return `stream:usage-${suffix}`;
}
