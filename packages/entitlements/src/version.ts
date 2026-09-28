/**
 * Entitlements + Billing contract versions and the closed vocabularies
 * (W024).
 *
 * architecture.md (binding): "Epoch owns listings, trust metadata,
 * versions, entitlements, usage accounting, and developer revenue records.
 * Payment processors are adapters." architecture lock rule 11 (binding):
 * "Marketplace entitlement is separate from payment processor state." Rule
 * 13: provider-specific behavior is adapterized.
 *
 * THE AUTHORITY SPLIT (lock rule 16 — one responsibility, one authority):
 * - Entitlement GRANT/REVOKE records and the pure grant check are
 *   @epoch/marketplace's authority (W023). This package CONSUMES them
 *   (runtime dependency, public API only) and NEVER re-declares them.
 * - The tenancy CONTAINMENT hierarchy is @epoch/tenancy's authority
 *   (W009). Resolution rides its seams; tenant/workspace/project scope
 *   validation is delegated to the real hierarchy.
 * - Delivery facts are @epoch/solution-delivery's authority (W036). Only
 *   digest-verified SealedDeliveryRecord actuals (derived from ACCEPTED
 *   observations by construction) may become billable lines.
 * - Developer REVENUE records are @epoch/marketplace's authority (W023).
 *   Billing owns INVOICES (the buyer-side billing document), not revenue.
 * - Settlement execution state is NEVER authority: the SettlementPort
 *   seam expresses CHECKS and record-shaped outcomes ONLY — the
 *   Epoch-owned invoice record is the billing authority (lock rule 11
 *   applied to settlement).
 *
 * Every vocabulary below is CLOSED (a typed union, never an open string)
 * and provider-neutral: no entry names a payment brand, gateway, bank, or
 * API surface.
 *
 * Versioning policy (mirrors @epoch/marketplace): a serialized
 * entitlements/billing record is admitted only when its `schemaVersion`
 * equals {@link ENTITLEMENTS_RECORD_VERSION} exactly; skew surfaces as a
 * `validation` issue at path ["schemaVersion"] before other schema
 * diagnostics. {@link ENTITLEMENTS_CONTRACT_VERSION} versions the
 * published contract surface (schemas/ + the typed index export).
 */

/** Version of the published entitlements+billing contract surface (schemas/ + types). */
export const ENTITLEMENTS_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized entitlements/billing record. */
export const ENTITLEMENTS_RECORD_VERSION = 1 as const;

/**
 * Version discriminator carried by every serialized entitlements/billing
 * event — MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION
 * (billing and seat events are append-only typed events over the W010
 * event shapes, the open `entitlements:`/`billing:` payload namespaces).
 * The runtime parity test asserts the constants are equal; a future W010
 * bump intentionally breaks that parity and surfaces here as a review
 * gate.
 */
export const ENTITLEMENTS_EVENT_RECORD_VERSION = 1 as const;

/** Schema discriminator of the sealed seat-assignment envelope. */
export const SEAT_ASSIGNMENT_SCHEMA_NAME = 'epoch.entitlements.seat-assignment' as const;

/** Schema discriminator of the sealed seat-release envelope. */
export const SEAT_RELEASE_SCHEMA_NAME = 'epoch.entitlements.seat-release' as const;

/** Schema discriminator of the sealed billing-account envelope. */
export const BILLING_ACCOUNT_SCHEMA_NAME = 'epoch.billing.account' as const;

/** Schema discriminator of the sealed invoice envelope. */
export const INVOICE_SCHEMA_NAME = 'epoch.billing.invoice' as const;

// --------------------------------------------------------------------------------
// Id grammars (kind-prefixed, opaque, provider-neutral — the house pattern).
// --------------------------------------------------------------------------------

/** Seat-assignment identity: `seat:<slug>`. */
export const SEAT_ASSIGNMENT_ID_PATTERN = /^seat:[a-z0-9][a-z0-9-]{0,62}$/;

/** Seat-release identity: `seat-release:<slug>`. */
export const SEAT_RELEASE_ID_PATTERN = /^seat-release:[a-z0-9][a-z0-9-]{0,58}$/;

/** Billing-account identity: `billing-account:<slug>`. */
export const BILLING_ACCOUNT_ID_PATTERN = /^billing-account:[a-z0-9][a-z0-9-]{0,49}$/;

/** Invoice identity: `invoice:<slug>`. */
export const INVOICE_ID_PATTERN = /^invoice:[a-z0-9][a-z0-9-]{0,62}$/;

/** Invoice line identity: `line:<slug>`. */
export const LINE_ITEM_ID_PATTERN = /^line:[a-z0-9][a-z0-9-]{0,62}$/;

/** Settlement identity: `settlement:<slug>`. */
export const SETTLEMENT_ID_PATTERN = /^settlement:[a-z0-9][a-z0-9-]{0,56}$/;

/**
 * Settlement-port identity: `port:<slug>` — grammar-identical to
 * @epoch/marketplace's PAYMENT_PORT_ID_PATTERN (the shared opaque port
 * grammar; pinned by the runtime parity test, never a runtime
 * dependency).
 */
export const SETTLEMENT_PORT_ID_PATTERN = /^port:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Entitlements stream identity: `stream:entitlements-<suffix>` — one
 * stream per entitlement's seat/coverage facts (the W010 stream grammar).
 */
export const ENTITLEMENTS_STREAM_ID_PATTERN = /^stream:entitlements-[a-z0-9][a-z0-9-]{0,48}$/;

/** Billing stream identity: `stream:billing-<suffix>` — one stream per billing account. */
export const BILLING_STREAM_ID_PATTERN = /^stream:billing-[a-z0-9][a-z0-9-]{0,51}$/;

/**
 * Principal identity of the actor named on entitlements/billing records.
 * MIRRORED from @epoch/identity's PRINCIPAL_ID_PATTERN (the W009
 * grammar) — pinned by the runtime parity test; never a runtime
 * dependency.
 */
export const ENTITLEMENTS_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

// --------------------------------------------------------------------------------
// The invoice lifecycle.
// --------------------------------------------------------------------------------

/**
 * The closed invoice lifecycle (the W024 pin): draft -> issued ->
 * settled | voided. An invoice is SEALED at draft (immutable lines);
 * `issued` names the buyer-facing document; `settled` records the
 * Epoch-owned settlement fact (port reference + settlement id); `voided`
 * withdraws an issued-or-draft invoice (terminal). There is no
 * `overdue` state — aging is a projection over caller-supplied instants,
 * never a state machine driven by wall clocks.
 */
export const INVOICE_LIFECYCLE_STATES = ['draft', 'issued', 'settled', 'voided'] as const;

/** One invoice lifecycle state. */
export type InvoiceLifecycleState = (typeof INVOICE_LIFECYCLE_STATES)[number];

/** The typed legal-successor table of the invoice lifecycle. */
export const INVOICE_LIFECYCLE_TRANSITIONS: Readonly<
  Record<InvoiceLifecycleState, readonly InvoiceLifecycleState[]>
> = {
  draft: ['issued', 'voided'],
  issued: ['settled', 'voided'],
  settled: [],
  voided: [],
};

// --------------------------------------------------------------------------------
// Billable line bases.
// --------------------------------------------------------------------------------

/**
 * The closed billable-line basis vocabulary. The first four members
 * MIRROR @epoch/marketplace's REVENUE_BASIS (one-time, subscription,
 * seat, usage — the pricing components a line can account for);
 * `delivery-actual` is the W024 extension: a billable line derived from a
 * W036 validated delivery actual (the "only VALIDATED actuals may bill"
 * pin).
 */
export const BILLING_LINE_BASIS = [
  'one-time',
  'subscription',
  'seat',
  'usage',
  'delivery-actual',
] as const;

/** One billable-line basis. */
export type BillingLineBasis = (typeof BILLING_LINE_BASIS)[number];

// --------------------------------------------------------------------------------
// The settlement seam vocabulary.
// --------------------------------------------------------------------------------

/**
 * The CLOSED record-shaped results a SettlementPort check may report. The
 * port expresses CHECKS and record-shaped outcomes ONLY — there is no
 * charge, capture, refund-execution, or credential vocabulary anywhere
 * (the port's own in-memory state is primed by its reference test API).
 */
export const SETTLEMENT_RESULTS = ['settled', 'unpaid', 'declined'] as const;

/** One settlement check result. */
export type SettlementResultKind = (typeof SETTLEMENT_RESULTS)[number];

// --------------------------------------------------------------------------------
// Event discriminators (the W010 open-namespace payload families).
// --------------------------------------------------------------------------------

/** The complete closed discriminator vocabulary of the entitlements/billing events. */
export const ENTITLEMENTS_EVENT_DISCRIMINATORS = [
  'entitlements:seat-assigned',
  'entitlements:seat-released',
  'billing:account-opened',
  'billing:invoice-drafted',
  'billing:invoice-issued',
  'billing:invoice-settled',
  'billing:invoice-voided',
] as const;

/** One entitlements/billing event discriminator. */
export type EntitlementsEventDiscriminator = (typeof ENTITLEMENTS_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Deterministic stream-id derivation.
// --------------------------------------------------------------------------------

/** The slug suffix of a kind-prefixed id (the segment after `:`; empty if absent). */
function idSuffixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(separator + 1);
}

/** Derive the entitlements stream id of one entitlement (deterministic). */
export function entitlementsStreamIdOf(entitlementId: string): string {
  return `stream:entitlements-${idSuffixOf(entitlementId)}`;
}

/** Derive the billing stream id of one billing account (deterministic). */
export function billingStreamIdOf(accountId: string): string {
  return `stream:billing-${idSuffixOf(accountId)}`;
}

/** The kind prefix of an entitlements/billing opaque id (the segment before `:`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}
