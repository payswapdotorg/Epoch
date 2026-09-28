/**
 * @epoch/external-event-bridge — contract versions and closed vocabularies.
 *
 * NEUTRAL SEAM (architecture lock rule 13: provider behavior is
 * adapterized; the integration contract rules that provider-specific
 * schemas never enter Epoch kernel types"): every vocabulary below names typed,
 * provider-neutral concepts of the external exchange domain — external
 * events, outbound requests, providers, receipts, fallbacks. The
 * concrete provider's vocabulary lives ONLY in a concrete adapter's
 * quarantined `src/provider/` layer (the W029 adapter convention) and
 * never crosses this seam; the per-package neutrality blocklist test
 * plus the per-adapter blocklist test pin that boundary.
 *
 * Lifecycle neutrality (architecture-lock universal-domain invariants):
 * the bridge carries ZERO pack-specific vocabulary — it may acquire
 * information or relay supervision for ANY domain pack, so no pack name,
 * pack namespace or pack branch exists anywhere in this package (the
 * `pack-branching-rejected` source-scan test).
 *
 * Versioning policy (v1, mirrors @epoch/solution-delivery): a serialized
 * bridge document (external event, intake proposal, outbound request,
 * filtered payload, provider registration, delivery receipt, fallback or
 * manual-queue record, bridge event) is admitted only when its
 * `schemaVersion` equals {@link EXTERNAL_EVENT_BRIDGE_RECORD_VERSION}
 * exactly; skew surfaces as a `version-unsupported` issue at path
 * ["schemaVersion"] before any other schema diagnostics.
 * {@link EXTERNAL_EVENT_BRIDGE_CONTRACT_VERSION} versions the published
 * contract surface (typed index export + record vocabularies) as a whole.
 */

/** Version of the published bridge contract surface (types + vocabularies). */
export const EXTERNAL_EVENT_BRIDGE_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized bridge record. */
export const EXTERNAL_EVENT_BRIDGE_RECORD_VERSION = 1 as const;

/**
 * The contract ids this package issues for W007 contract references
 * (capability manifests reference the contracts they honor).
 */
export const BRIDGE_PROVIDER_CONTRACT_ID = 'epoch.bridge.provider-exchange' as const;

// --------------------------------------------------------------------------------
// Inbound: the normalized external-event class vocabulary.
// --------------------------------------------------------------------------------

/**
 * The typed INBOUND event classes (the external-integration contract
 * inbound catalog, provider-neutral): a normalized observation report
 * (which the bridge proposes as W036 observation INTAKE), an evidence
 * reference, a delivery-lifecycle event, an acknowledgement, a response
 * to a prior information request, a status report, an exception/failure,
 * and a communication delivery receipt.
 */
export const INBOUND_EVENT_CLASSES = [
  'observation-report',
  'evidence-reference',
  'delivery-event',
  'acknowledgement',
  'information-response',
  'status-report',
  'exception',
  'communication-receipt',
] as const;

/** One inbound event class. */
export type InboundEventClass = (typeof INBOUND_EVENT_CLASSES)[number];

// --------------------------------------------------------------------------------
// Outbound: the four request classes (the W042 dispatch pin, frozen).
// --------------------------------------------------------------------------------

/**
 * The typed OUTBOUND request classes — EXACTLY FOUR (the W042 Tech Lead
 * pin): information (acquire information / ask an authorized person),
 * status (obtain a status update), alert (send a notification/alert),
 * acknowledgement-request (request an acknowledgement). Acquisition
 * orders remain the W036 external seam's vocabulary; the bridge never
 * re-declares them.
 */
export const OUTBOUND_REQUEST_CLASSES = [
  'information',
  'status',
  'alert',
  'acknowledgement-request',
] as const;

/** One outbound request class. */
export type OutboundRequestClass = (typeof OUTBOUND_REQUEST_CLASSES)[number];

// --------------------------------------------------------------------------------
// Provider discovery: registration + fallback vocabularies.
// --------------------------------------------------------------------------------

/**
 * The typed fallback modes when a provider is missing or unregistered
 * for a request class (the spec's failure-and-fallback discipline: the
 * bridge continues normally, requests become pending/manual/alternative
 * work items according to policy, no project truth is fabricated, an
 * unresolved request remains explicit).
 */
export const PROVIDER_FALLBACK_MODES = [
  'fallback',
  'manual-queue',
  'alternative-provider',
] as const;

/** One fallback mode. */
export type ProviderFallbackMode = (typeof PROVIDER_FALLBACK_MODES)[number];

/**
 * The typed reasons a provider-class resolution fails (carried by the
 * provider-unavailable record; the request stays explicitly unresolved).
 */
export const PROVIDER_UNAVAILABLE_REASONS = [
  'no-provider-registered',
  'provider-lacks-class',
  'preferred-provider-unregistered',
  'fallback-provider-unregistered',
  'fallback-provider-lacks-class',
  'no-alternative-provider',
] as const;

/** One provider-unavailability reason. */
export type ProviderUnavailableReason = (typeof PROVIDER_UNAVAILABLE_REASONS)[number];

// --------------------------------------------------------------------------------
// Delivery: attempt outcomes + retry vocabulary.
// --------------------------------------------------------------------------------

/**
 * The typed per-attempt delivery outcomes a provider port may report:
 * delivered successfully, failed but retryable (the retry schedule
 * continues), or failed terminally (no further attempt of this provider
 * helps; the fallback policy applies).
 */
export const DELIVERY_ATTEMPT_OUTCOMES = ['success', 'retryable', 'terminal'] as const;

/** One delivery-attempt outcome. */
export type DeliveryAttemptOutcome = (typeof DELIVERY_ATTEMPT_OUTCOMES)[number];

// --------------------------------------------------------------------------------
// Provenance: the W006-shaped provenance kinds carried on every record.
// --------------------------------------------------------------------------------

/**
 * The provenance kinds of bridge records (the W006 grammar the W036
 * provenance state also uses): an external event is `reported` by its
 * source (an adapter never *observes* on the world's behalf); a receipt
 * is `derived` from a delivery attempt; a registration is `imported`
 * capability metadata.
 */
export const BRIDGE_PROVENANCE_KINDS = ['observed', 'reported', 'derived', 'imported'] as const;

/** One bridge provenance kind. */
export type BridgeProvenanceKind = (typeof BRIDGE_PROVENANCE_KINDS)[number];

// --------------------------------------------------------------------------------
// Id grammar (opaque, kind-prefixed — the W010/W009 convention).
// --------------------------------------------------------------------------------

/** Id grammar of normalized external events (`bridge-event:<slug>`). */
export const BRIDGE_EVENT_ID_PATTERN = /^bridge-event:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of observation intake proposals (`intake:<slug>`). */
export const INTAKE_PROPOSAL_ID_PATTERN = /^intake:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of outbound requests (`outbound:<slug>`). */
export const OUTBOUND_REQUEST_ID_PATTERN = /^outbound:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of provider registrations (`registration:<slug>`). */
export const PROVIDER_REGISTRATION_ID_PATTERN = /^registration:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of delivery receipts (`receipt:<slug>`). */
export const DELIVERY_RECEIPT_ID_PATTERN = /^receipt:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of intake receipts (`intake-receipt:<slug>`). */
export const INTAKE_RECEIPT_ID_PATTERN = /^intake-receipt:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of manual-queue records (`manual:<slug>`). */
export const MANUAL_QUEUE_ID_PATTERN = /^manual:[a-z0-9][a-z0-9-]{0,62}$/;

/** Grammar of correlation ids (opaque, 1..128 chars). */
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Grammar of causation ids (opaque, 1..128 chars). */
export const CAUSATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Grammar of idempotency keys (opaque, 1..128 chars). */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Grammar of opaque recipient references (1..256 chars). */
export const RECIPIENT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;

/** Grammar of the actor principal inside bridge records (W009 mirror). */
export const BRIDGE_ACTOR_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** Grammar of bridge event streams (`stream:<slug>` — the W010 mirror). */
export const BRIDGE_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/** Grammar of field-path allowlist templates (the W041 mirror). */
export const FIELD_TEMPLATE_PATTERN =
  /^[A-Za-z0-9_][A-Za-z0-9_.[\]-]{0,511}$/;

// --------------------------------------------------------------------------------
// The bridge:* lifecycle event vocabulary (W010-shaped).
// --------------------------------------------------------------------------------

/**
 * The `bridge:*` event discriminators (the open W010 namespace —
 * `bridge` is not a reserved kernel namespace, so this is the extension
 * payload-family discipline over the W010 event shapes).
 */
export const BRIDGE_EVENT_DISCRIMINATORS = [
  'bridge:provider-registered',
  'bridge:event-received',
  'bridge:intake-proposed',
  'bridge:request-dispatched',
  'bridge:receipt-recorded',
  'bridge:fallback-applied',
  'bridge:manual-queued',
  'bridge:provider-unavailable',
] as const;

/** One bridge:* event discriminator. */
export type BridgeEventDiscriminator = (typeof BRIDGE_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Schema discriminator literals (one per record family).
// --------------------------------------------------------------------------------

/** Schema discriminator of normalized external events. */
export const EXTERNAL_EVENT_SCHEMA_NAME = 'epoch.external-event-bridge.external-event' as const;

/** Schema discriminator of observation intake proposals. */
export const INTAKE_PROPOSAL_SCHEMA_NAME =
  'epoch.external-event-bridge.intake-proposal' as const;

/** Schema discriminator of outbound requests. */
export const OUTBOUND_REQUEST_SCHEMA_NAME = 'epoch.external-event-bridge.outbound-request' as const;

/** Schema discriminator of provider registrations. */
export const PROVIDER_REGISTRATION_SCHEMA_NAME =
  'epoch.external-event-bridge.provider-registration' as const;

/** Schema discriminator of delivery receipts. */
export const DELIVERY_RECEIPT_SCHEMA_NAME = 'epoch.external-event-bridge.delivery-receipt' as const;

/** Schema discriminator of intake receipts. */
export const INTAKE_RECEIPT_SCHEMA_NAME = 'epoch.external-event-bridge.intake-receipt' as const;

/** Schema discriminator of provider-unavailability records. */
export const PROVIDER_UNAVAILABLE_SCHEMA_NAME =
  'epoch.external-event-bridge.provider-unavailable' as const;

/** Schema discriminator of manual-queue records. */
export const MANUAL_QUEUE_SCHEMA_NAME = 'epoch.external-event-bridge.manual-queue' as const;

/** Schema discriminator of bridge lifecycle events. */
export const BRIDGE_EVENT_SCHEMA_NAME = 'epoch.external-event-bridge.event' as const;

// --------------------------------------------------------------------------------
// Stream derivation (deterministic, the W041 convention).
// --------------------------------------------------------------------------------

/** `tenant:globex` -> `stream:bridge-globex` (the per-tenant bridge stream). */
export function bridgeStreamIdOf(tenantId: string): string {
  return `stream:bridge-${tenantId.replace(/:/g, '-')}`;
}
