/**
 * Procurement contract versions and the closed vocabularies (W037).
 *
 * Procurement is the CONSTRUCTION/COMMERCIAL PROJECTION of the universal
 * Acquire contract (USL1.0: "Procurement is therefore a domain-specific
 * acquisition projection, not the universal authority"). The acquisition
 * VARIANT catalog, the nine semantic-distinction record kinds, the
 * ProgramOfWork, the DeliveryRecord observation/acceptance/actualization
 * machinery and the uncertainty states are @epoch/solution-delivery's
 * (W036) — this package EXTENDS the projection layer over that kernel and
 * never creates a second lifecycle authority (anything needing new
 * lifecycle semantics is an architecture question, not a field).
 *
 * Every vocabulary below is CLOSED (a typed union, never an open string)
 * and provider-neutral: no entry names a vendor, brand, marketplace, ERP,
 * PM tool or API surface. Supplier identity is an OPAQUE id
 * (`supplier:<slug>`); concrete supplier systems stay behind the
 * service-layer SupplierPort adapter seam.
 *
 * Versioning policy (mirrors @epoch/solution-delivery): a serialized
 * procurement record is admitted only when its `schemaVersion` equals
 * {@link PROCUREMENT_RECORD_VERSION} exactly; skew surfaces as a
 * `validation` issue at path ["schemaVersion"]. {@link
 * PROCUREMENT_CONTRACT_VERSION} versions the published contract surface
 * (schemas/ + the typed index export + contracts/procurement).
 */
import { ACQUISITION_VARIANTS } from '@epoch/solution-delivery';

/** Version of the published procurement contract surface (schemas/ + types). */
export const PROCUREMENT_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized procurement record. */
export const PROCUREMENT_RECORD_VERSION = 1 as const;

/**
 * Version discriminator carried by every serialized procurement event —
 * MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION (procurement
 * events are append-only typed events over the W010 event shapes, the
 * open `procurement:` payload namespace). The runtime parity test
 * asserts the constants are equal; a future W010 bump intentionally
 * breaks that parity and surfaces here as a review gate.
 */
export const PROCUREMENT_EVENT_RECORD_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// Supplier-delivery state machine (the W037 pin: ordered -> confirmed ->
// shipped/partial -> received -> accepted | rejected | disputed).
// --------------------------------------------------------------------------------

/** The supplier-delivery states of one purchase order. */
export const SUPPLIER_DELIVERY_STATES = [
  'ordered',
  'confirmed',
  'shipped',
  'partial',
  'received',
  'accepted',
  'rejected',
  'disputed',
] as const;

/** One supplier-delivery state. */
export type SupplierDeliveryState = (typeof SUPPLIER_DELIVERY_STATES)[number];

/** The initial supplier-delivery state of every purchase order. */
export const INITIAL_SUPPLIER_DELIVERY_STATE: SupplierDeliveryState = 'ordered';

/**
 * The CLOSED supplier-delivery transition table (append-only transitions;
 * `partial -> partial` is how partial deliveries ACCUMULATE):
 *
 * - `ordered -> confirmed | shipped` — supplier confirmation or direct shipment;
 * - `confirmed -> shipped | partial` — shipment, first partial shipment;
 * - `shipped -> partial | received` — subsequent partial, full receipt;
 * - `partial -> partial | received` — accumulation, completion of receipt;
 * - `received -> accepted | rejected | disputed` — the receiving decision;
 * - `rejected -> disputed` — escalation of a rejection into a dispute;
 * - `disputed -> received` — dispute resolution returning to receipt;
 * - `accepted` is TERMINAL (acceptance is the commercial end state).
 */
export const SUPPLIER_DELIVERY_TRANSITIONS: Readonly<
  Record<SupplierDeliveryState, readonly SupplierDeliveryState[]>
> = {
  ordered: ['confirmed', 'shipped'],
  confirmed: ['shipped', 'partial'],
  shipped: ['partial', 'received'],
  partial: ['partial', 'received'],
  received: ['accepted', 'rejected', 'disputed'],
  accepted: [],
  rejected: ['disputed'],
  disputed: ['received'],
};

/** The supplier-delivery states that REQUIRE a receipt payload. */
export const RECEIPT_BEARING_STATES: readonly SupplierDeliveryState[] = [
  'partial',
  'received',
];

// --------------------------------------------------------------------------------
// Quote vocabulary.
// --------------------------------------------------------------------------------

/** The quote lifecycle states (a quote is withdrawn by a new revision). */
export const QUOTE_STATES = ['submitted', 'withdrawn'] as const;

/** One quote state. */
export type QuoteState = (typeof QUOTE_STATES)[number];

/** The quote-line allocation states (offers/allocations vocabulary). */
export const QUOTE_ALLOCATION_STATES = ['reserved', 'allocated'] as const;

/** One quote-line allocation state. */
export type QuoteAllocationState = (typeof QUOTE_ALLOCATION_STATES)[number];

// --------------------------------------------------------------------------------
// Substitution vocabulary.
// --------------------------------------------------------------------------------

/** The lead-time observation semantics (W036 distinction references). */
export const LEAD_TIME_SEMANTICS = ['prediction', 'estimate'] as const;

/** One lead-time semantics kind. */
export type LeadTimeSemantics = (typeof LEAD_TIME_SEMANTICS)[number];

// --------------------------------------------------------------------------------
// The acquisition-status projection vocabulary (DERIVED ONLY — sealed
// projection over the records; there is no in-place mutation API).
// --------------------------------------------------------------------------------

/** The acquisition-status states of one acquisition package. */
export const PROCUREMENT_STATUS_STATES = [
  'awaiting-quote',
  'quoted',
  'selected',
  'committed',
  'ordered',
  'confirmed',
  'shipped',
  'partial',
  'received',
  'accepted',
  'rejected',
  'disputed',
] as const;

/** One acquisition-status state. */
export type ProcurementStatusState = (typeof PROCUREMENT_STATUS_STATES)[number];

// --------------------------------------------------------------------------------
// The procurement:* event vocabulary (the open-namespace family owned by
// this package; the W010 shapes carry the events).
// --------------------------------------------------------------------------------

/** The procurement lifecycle event discriminators. */
export const PROCUREMENT_EVENT_DISCRIMINATORS = [
  'procurement:package-assembled',
  'procurement:quote-received',
  'procurement:quote-selected',
  'procurement:commitment-linked',
  'procurement:po-issued',
  'procurement:po-amended',
  'procurement:delivery-transition-recorded',
  'procurement:receipt-recorded',
  'procurement:substitution-requested',
  'procurement:substitution-decided',
  'procurement:status-projected',
] as const;

/** One procurement event payload discriminator. */
export type ProcurementEventDiscriminator = (typeof PROCUREMENT_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Schema discriminator names (the sealed-envelope discipline: a literal
// `schema` names the record family so mixed envelopes cannot be confused
// at admission).
// --------------------------------------------------------------------------------

export const REQUIREMENT_LINEAGE_SCHEMA_NAME = 'epoch.procurement.requirement-lineage' as const;
export const ACQUISITION_PACKAGE_SCHEMA_NAME = 'epoch.procurement.acquisition-package' as const;
export const QUOTE_SCHEMA_NAME = 'epoch.procurement.quote' as const;
export const QUOTE_SELECTION_SCHEMA_NAME = 'epoch.procurement.quote-selection' as const;
export const PURCHASE_ORDER_SCHEMA_NAME = 'epoch.procurement.purchase-order' as const;
export const SUPPLIER_DELIVERY_TRANSITION_SCHEMA_NAME =
  'epoch.procurement.supplier-delivery-transition' as const;
export const SUBSTITUTION_REQUEST_SCHEMA_NAME = 'epoch.procurement.substitution-request' as const;
export const SUBSTITUTION_DECISION_SCHEMA_NAME = 'epoch.procurement.substitution-decision' as const;
export const ACQUISITION_STATUS_SCHEMA_NAME = 'epoch.procurement.acquisition-status' as const;
export const PROCUREMENT_EVENT_SCHEMA_NAME = 'epoch.procurement.event' as const;

// --------------------------------------------------------------------------------
// Opaque, kind-prefixed identity grammars (the W002/W009/W010/W023/W036
// house pattern). The segment before `:` is the record kind; the slug is
// a lowercase kebab of length <= 63.
// --------------------------------------------------------------------------------

/** Requirement-lineage record identity: `lineage:<slug>`. */
export const LINEAGE_ID_PATTERN = /^lineage:[a-z0-9][a-z0-9-]{0,62}$/;

/** Acquisition-package record identity: `package:<slug>`. */
export const PACKAGE_ID_PATTERN = /^package:[a-z0-9][a-z0-9-]{0,62}$/;

/** Quote record identity: `quote:<slug>`. */
export const QUOTE_ID_PATTERN = /^quote:[a-z0-9][a-z0-9-]{0,62}$/;

/** Quote-selection record identity: `selection:<slug>`. */
export const SELECTION_ID_PATTERN = /^selection:[a-z0-9][a-z0-9-]{0,62}$/;

/** Purchase-order record identity: `po:<slug>`. */
export const PO_ID_PATTERN = /^po:[a-z0-9][a-z0-9-]{0,62}$/;

/** Supplier-delivery transition record identity: `po-transition:<slug>`. */
export const PO_TRANSITION_ID_PATTERN = /^po-transition:[a-z0-9][a-z0-9-]{0,62}$/;

/** Substitution record identity: `substitution:<slug>`. */
export const SUBSTITUTION_ID_PATTERN = /^substitution:[a-z0-9][a-z0-9-]{0,62}$/;

/** Opaque supplier identity: `supplier:<slug>` (never a vendor name). */
export const SUPPLIER_ID_PATTERN = /^supplier:[a-z0-9][a-z0-9-]{0,62}$/;

/** Purchase-order document version counter (1-based, contiguous per poId). */
export const PO_VERSION_PATTERN = /^[1-9][0-9]{0,14}$/;

/**
 * Procurement event stream identity — MIRRORED from @epoch/event-log's
 * EVENT_STREAM_ID_PATTERN (W010 grammar): `stream:<slug>`. One
 * acquisition package's lifecycle events form one stream
 * (`stream:procurement-<suffix>`); pinned by the runtime parity test.
 */
export const PROCUREMENT_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Acting principal grammar — MIRRORED from @epoch/event-log's
 * EVENT_ACTOR_PATTERN (the W009 identity grammar; runtime parity test
 * pins the pattern-identical constants).
 */
export const PROCUREMENT_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** The acquisition-variant catalog this projection extends (W036, binding). */
export const PROCUREMENT_ACQUISITION_VARIANTS: readonly string[] = ACQUISITION_VARIANTS;

/** The kind prefix of a procurement opaque id (the segment before `:`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}

/**
 * Derive the procurement event stream id of one acquisition package:
 * `stream:procurement-<suffix>` where the suffix is the package id's
 * slug (the package id grammar bounds the suffix so the derived stream
 * id always satisfies the W010 stream grammar). Deterministic.
 */
export function procurementStreamIdOf(packageId: string): string {
  return `stream:procurement-${packageId.slice('package:'.length)}`;
}
