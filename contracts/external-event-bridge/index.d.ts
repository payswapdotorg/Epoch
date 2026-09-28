/**
 * Epoch External Event Bridge v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/external-event-bridge` ownership boundary (Work Order
 * W042). It is self-contained: no imports, no runtime code, no
 * provider/vendor vocabulary (the concrete provider adapter is
 * `@epoch/adapter-aurum-chat`, never referenced here — compatible
 * providers may be substituted without changing these semantic types).
 * The runtime implementation lives in
 * `@epoch/external-event-bridge` (kernel layer); `parity.ts` in this
 * directory proves at compile time that the implementation's
 * zod-inferred types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 *
 * Authority (the W042 dispatch pins): the bridge is a provider-neutral
 * exchange seam — inbound external events become W036-shaped
 * observation INTAKE PROPOSALS through the existing delivery authority
 * path (the bridge NEVER writes observations directly); outbound
 * requests carry payloads filtered to least privilege through a W041
 * projection-policy typed reference; providers are resolved BY CLASS
 * with optional-provider fallback semantics; core flows run with NO
 * bridge installed. The lifecycle stays neutral: the bridge may acquire
 * information or relay supervision for ANY domain pack.
 */

// ---------------------------------------------------------------------------
// Neutral primitives (self-contained mirrors of the shared grammars).
// ---------------------------------------------------------------------------

/** One canonical JSON value (the shared protocol grammar). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** One producer-supplied instant in the canonical UTC form. */
export type Timestamp = string;

/** One tenant id (the W009 tenancy grammar, `tenant:<slug>`). */
export type TenantId = string;

/** One acting principal (the W009 identity grammar, `principal:<slug>`). */
export type PrincipalId = string;

/** One SHA-256 content digest (64 lowercase hex characters). */
export type Sha256Hex = string;

/** One registered adapter id (the W007 grammar, `adapter:<slug>`). */
export type AdapterId = string;

/** One normalized external-event id (`bridge-event:<slug>`). */
export type ExternalEventId = string;

/** One observation intake-proposal id (`intake:<slug>`). */
export type IntakeProposalId = string;

/** One outbound request id (`outbound:<slug>`). */
export type OutboundRequestId = string;

/** One provider-registration id (`registration:<slug>`). */
export type ProviderRegistrationId = string;

/** One delivery-receipt id (`receipt:<slug>`). */
export type DeliveryReceiptId = string;

/** One intake-receipt id (`intake-receipt:<slug>`). */
export type IntakeReceiptId = string;

/** One manual-queue record id (`manual:<slug>`). */
export type ManualQueueId = string;

/** One correlation id (ties an outbound request to its inbound responses). */
export type CorrelationId = string;

/** One causation id (the prior fact this record is caused by). */
export type CausationId = string;

/** One idempotency key (the duplicate-delivery identity). */
export type IdempotencyKey = string;

/** One opaque recipient reference (a channel, role or person selector). */
export type RecipientRef = string;

/** One field-path allowlist template (the W041 grammar mirror). */
export type FieldTemplate = string;

/** One bridge event stream id (the W010 grammar mirror, `stream:<slug>`). */
export type BridgeStreamId = string;

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Version of the published external-event-bridge contract surface. */
export type ExternalEventBridgeContractVersion = '1.0.0';

/**
 * The typed INBOUND event classes (the integration-contract inbound
 * catalog, provider-neutral).
 */
export type InboundEventClass =
  | 'observation-report'
  | 'evidence-reference'
  | 'delivery-event'
  | 'acknowledgement'
  | 'information-response'
  | 'status-report'
  | 'exception'
  | 'communication-receipt';

/** The four typed OUTBOUND request classes (frozen). */
export type OutboundRequestClass =
  | 'information'
  | 'status'
  | 'alert'
  | 'acknowledgement-request';

/** The typed fallback modes when a provider is missing or unregistered. */
export type ProviderFallbackMode =
  | 'fallback'
  | 'manual-queue'
  | 'alternative-provider';

/** The typed reasons a provider-class resolution fails. */
export type ProviderUnavailableReason =
  | 'no-provider-registered'
  | 'provider-lacks-class'
  | 'preferred-provider-unregistered'
  | 'fallback-provider-unregistered'
  | 'fallback-provider-lacks-class'
  | 'no-alternative-provider';

/** The typed per-attempt delivery outcomes a provider port reports. */
export type DeliveryAttemptOutcome = 'success' | 'retryable' | 'terminal';

/** The W006-shaped provenance kinds carried on bridge records. */
export type BridgeProvenanceKind = 'observed' | 'reported' | 'derived' | 'imported';

/** The redaction classes of struck outbound fields (the W041 mirror). */
export type BridgeRedactionClass =
  | 'commercial-sensitive'
  | 'supplier-sensitive'
  | 'evidence-scoped'
  | 'principal-identifying'
  | 'policy-scoped'
  | 'task-scoped';

/** The `bridge:*` lifecycle event discriminators (the W010-shaped vocabulary). */
export type BridgeEventDiscriminator =
  | 'bridge:provider-registered'
  | 'bridge:event-received'
  | 'bridge:intake-proposed'
  | 'bridge:request-dispatched'
  | 'bridge:receipt-recorded'
  | 'bridge:fallback-applied'
  | 'bridge:manual-queued'
  | 'bridge:provider-unavailable';

// ---------------------------------------------------------------------------
// The W007 adapter-descriptor mirror (the SDK shapes, structural).
// ---------------------------------------------------------------------------

/** The Capability Fabric adapter categories (the W007 vocabulary). */
export type CapabilityCategory =
  | 'source'
  | 'semantic'
  | 'reconstruction'
  | 'visualization'
  | 'simulation'
  | 'evaluator'
  | 'action'
  | 'verification';

/** The version range an adapter declares it serves (exact or caret). */
export type CapabilityVersionRange =
  | { readonly kind: 'exact'; readonly version: string }
  | { readonly kind: 'caret'; readonly version: string };

/** The capability binding: which capability at which version range an adapter serves. */
export interface CapabilityBinding {
  readonly capabilityId: string;
  readonly versionRange: CapabilityVersionRange;
}

/** The W007 adapter descriptor (the SDK shape, structural mirror). */
export interface AdapterDescriptor {
  readonly schemaVersion: 1;
  readonly adapterId: AdapterId;
  readonly category: CapabilityCategory;
  readonly displayName: string;
  readonly description?: string | undefined;
  readonly binding: CapabilityBinding;
}

// ---------------------------------------------------------------------------
// The W009 authorization gate mirrors (the structural consumption shapes).
// ---------------------------------------------------------------------------

/** The tenancy-scoped resource a bridge operation acts on (the W009 mirror). */
export interface BridgeResourceReference {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly tenantId?: TenantId | undefined;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

/** The authorization request the bridge gate consumes (the W009 mirror). */
export interface BridgeAuthorizationRequest {
  readonly schemaVersion: 1;
  readonly principalId: PrincipalId;
  readonly actionKind: string;
  readonly resource: BridgeResourceReference;
  readonly justification?: string | undefined;
}

/** The structural authorization-decision subset the bridge gate consumes. */
export interface BridgeAuthorizationDecision {
  readonly requestDigest: Sha256Hex;
  readonly outcome: 'allow' | 'deny' | 'not-applicable';
}

// ---------------------------------------------------------------------------
// Provenance + the normalized inbound contract.
// ---------------------------------------------------------------------------

/**
 * The W006-shaped provenance of one bridge record: adapter identity,
 * exact adapter-descriptor digest, the provider's own opaque event
 * reference, the raw provider-payload digest, and the provenance kind.
 */
export interface BridgeProvenance {
  readonly kind: BridgeProvenanceKind;
  readonly adapterId: AdapterId;
  readonly adapterDescriptorDigest: Sha256Hex;
  readonly providerEventRef: string;
  readonly providerPayloadDigest: Sha256Hex;
  readonly recordedBy?: PrincipalId | undefined;
}

/** The immutable content of one normalized external event. */
export interface ExternalEventContent {
  readonly schema: 'epoch.external-event-bridge.external-event';
  readonly schemaVersion: 1;
  readonly eventId: ExternalEventId;
  readonly tenantId: TenantId;
  readonly eventClass: InboundEventClass;
  readonly source: BridgeProvenance;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId | null;
  readonly occurredAt: Timestamp;
  readonly payload: Readonly<Record<string, JsonValue>>;
  readonly confidence: Readonly<Record<string, JsonValue>>;
  readonly idempotencyKey: IdempotencyKey;
}

/** The sealed external event: content plus its canonical SHA-256 digest. */
export interface SealedExternalEvent extends ExternalEventContent {
  readonly contentDigest: Sha256Hex;
}

/**
 * The W036-shaped observation slot of one intake proposal: the W036
 * observation distinction-record envelope with opaque
 * subject/measure/payload/uncertainty slots (validated by the W036
 * authority on admission — never by the bridge).
 */
export interface ObservationIntakePayload {
  readonly schema: 'epoch.solution-delivery.distinction-record';
  readonly schemaVersion: 1;
  readonly kind: 'observation';
  readonly recordId: string;
  readonly tenantId: TenantId;
  readonly subject: JsonValue;
  readonly measure: JsonValue;
  readonly payload: JsonValue;
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly uncertainty: JsonValue;
}

/** The immutable content of one observation intake proposal. */
export interface ObservationIntakeProposalContent {
  readonly schema: 'epoch.external-event-bridge.intake-proposal';
  readonly schemaVersion: 1;
  readonly proposalId: IntakeProposalId;
  readonly tenantId: TenantId;
  readonly sourceEventId: ExternalEventId;
  readonly sourceEventDigest: Sha256Hex;
  readonly source: BridgeProvenance;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId | null;
  readonly observation: ObservationIntakePayload;
  readonly proposedAt: Timestamp;
  readonly proposedBy: PrincipalId;
}

/** The sealed observation intake proposal: content plus its digest. */
export interface SealedObservationIntakeProposal extends ObservationIntakeProposalContent {
  readonly contentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The normalized outbound contract (four classes, least privilege).
// ---------------------------------------------------------------------------

/** The least-privilege projection reference (the W041 typed reference). */
export interface LeastPrivilegeProjection {
  readonly policyDigest: Sha256Hex;
  readonly recipientRef: RecipientRef;
  readonly fieldAllowlist: readonly FieldTemplate[];
}

/** One released outbound field (carried BY REFERENCE — same value, same digest). */
export interface ReleasedField {
  readonly path: string;
  readonly value: JsonValue;
}

/** One typed redaction marker of a struck outbound field (never a silent drop). */
export interface OutboundRedactionMarker {
  readonly path: string;
  readonly redactionClass: BridgeRedactionClass;
}

/** The filtered outbound payload: released fields plus redaction markers. */
export interface FilteredOutboundPayload {
  readonly released: readonly ReleasedField[];
  readonly redacted: readonly OutboundRedactionMarker[];
}

/** The immutable content of one outbound request. */
export interface OutboundRequestContent {
  readonly schema: 'epoch.external-event-bridge.outbound-request';
  readonly schemaVersion: 1;
  readonly requestId: OutboundRequestId;
  readonly tenantId: TenantId;
  readonly requestClass: OutboundRequestClass;
  readonly recipientRef: RecipientRef;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId | null;
  readonly payload: FilteredOutboundPayload;
  readonly projectionDigest: Sha256Hex;
  readonly createdAt: Timestamp;
  readonly createdBy: PrincipalId;
  readonly idempotencyKey: IdempotencyKey;
}

/** The sealed outbound request: content plus its canonical digest. */
export interface SealedOutboundRequest extends OutboundRequestContent {
  readonly contentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// Retry, receipts, unavailability, fallback, manual queue.
// ---------------------------------------------------------------------------

/** The typed retry policy: caller-supplied attempt instants (DATA — no timers). */
export interface RetryPolicy {
  readonly attemptInstants: readonly Timestamp[];
}

/** The immutable content of one delivery-attempt receipt. */
export interface DeliveryReceiptContent {
  readonly schema: 'epoch.external-event-bridge.delivery-receipt';
  readonly schemaVersion: 1;
  readonly receiptId: DeliveryReceiptId;
  readonly tenantId: TenantId;
  readonly requestId: OutboundRequestId;
  readonly requestClass: OutboundRequestClass;
  readonly attemptNo: number;
  readonly scheduledAt: Timestamp;
  readonly outcome: DeliveryAttemptOutcome;
  readonly providerAdapterId: AdapterId;
  readonly providerDeliveryRef?: string | undefined;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId | null;
  readonly detail?: string | undefined;
}

/** The sealed delivery receipt: content plus its canonical digest. */
export interface SealedDeliveryReceipt extends DeliveryReceiptContent {
  readonly contentDigest: Sha256Hex;
}

/** The immutable content of one intake receipt. */
export interface IntakeReceiptContent {
  readonly schema: 'epoch.external-event-bridge.intake-receipt';
  readonly schemaVersion: 1;
  readonly receiptId: IntakeReceiptId;
  readonly tenantId: TenantId;
  readonly eventId: ExternalEventId;
  readonly eventDigest: Sha256Hex;
  readonly idempotencyKey: IdempotencyKey;
  readonly disposition: 'admitted' | 'duplicate-returned';
  readonly proposalDigest?: Sha256Hex | undefined;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId | null;
  readonly receivedAt: Timestamp;
}

/** The sealed intake receipt: content plus its canonical digest. */
export interface SealedIntakeReceipt extends IntakeReceiptContent {
  readonly contentDigest: Sha256Hex;
}

/** The immutable content of one provider-unavailability record. */
export interface ProviderUnavailableContent {
  readonly schema: 'epoch.external-event-bridge.provider-unavailable';
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly requestId: OutboundRequestId;
  readonly requestClass: OutboundRequestClass;
  readonly reason: ProviderUnavailableReason;
  readonly candidateAdapterIds: readonly AdapterId[];
  readonly preferredAdapterId?: AdapterId | undefined;
  readonly fallbackMode?: ProviderFallbackMode | undefined;
  readonly detectedAt: Timestamp;
}

/** The sealed provider-unavailability record: content plus its digest. */
export interface SealedProviderUnavailable extends ProviderUnavailableContent {
  readonly contentDigest: Sha256Hex;
}

/** The typed fallback directive (the three fallback modes as DATA). */
export type ProviderFallbackDirective =
  | { readonly mode: 'fallback'; readonly fallbackAdapterId: AdapterId }
  | { readonly mode: 'manual-queue' }
  | { readonly mode: 'alternative-provider'; readonly excludeAdapterIds: readonly AdapterId[] };

/** The immutable content of one manual-queue record. */
export interface ManualQueueRecordContent {
  readonly schema: 'epoch.external-event-bridge.manual-queue';
  readonly schemaVersion: 1;
  readonly recordId: ManualQueueId;
  readonly tenantId: TenantId;
  readonly requestId: OutboundRequestId;
  readonly requestClass: OutboundRequestClass;
  readonly recipientRef: RecipientRef;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId | null;
  readonly requestDigest: Sha256Hex;
  readonly reason: 'provider-unavailable' | 'delivery-terminal';
  readonly unavailabilityDigest?: Sha256Hex | undefined;
  readonly resolution: 'pending';
  readonly queuedAt: Timestamp;
  readonly queuedBy: PrincipalId;
}

/** The sealed manual-queue record: content plus its digest. */
export interface SealedManualQueueRecord extends ManualQueueRecordContent {
  readonly contentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The provider registration (capability discovery).
// ---------------------------------------------------------------------------

/** The immutable content of one provider registration. */
export interface ProviderRegistrationContent {
  readonly schema: 'epoch.external-event-bridge.provider-registration';
  readonly schemaVersion: 1;
  readonly registrationId: ProviderRegistrationId;
  readonly tenantId: TenantId;
  readonly adapterDescriptor: AdapterDescriptor;
  readonly adapterDescriptorDigest: Sha256Hex;
  readonly capabilityBinding: CapabilityBinding;
  readonly supportedInboundClasses: readonly InboundEventClass[];
  readonly supportedOutboundClasses: readonly OutboundRequestClass[];
  readonly registeredAt: Timestamp;
  readonly registeredBy: PrincipalId;
}

/** The sealed provider registration: content plus its canonical digest. */
export interface SealedProviderRegistration extends ProviderRegistrationContent {
  readonly contentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The bridge:* lifecycle events (W010-shaped).
// ---------------------------------------------------------------------------

/** One bridge event sequence number (1-based, contiguous per stream). */
export type BridgeEventSequence = number;

/** The causal parent reference of a bridge event (strictly earlier in-stream). */
export interface BridgeCausalParent {
  readonly streamId: BridgeStreamId;
  readonly sequence: BridgeEventSequence;
}

/** The generic event payload of a bridge event (the W010 shape). */
export interface BridgeEventPayload {
  readonly discriminator: string;
  readonly data: Readonly<Record<string, JsonValue>>;
}

/** The immutable content of one bridge event (the W010 event shape). */
export interface BridgeEventContent {
  readonly schemaVersion: 1;
  readonly streamId: BridgeStreamId;
  readonly sequence: BridgeEventSequence;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: BridgeCausalParent | null;
  readonly payload: BridgeEventPayload;
  readonly occurredAt: Timestamp;
}

/** The sealed bridge event record: content plus its canonical digest. */
export interface SealedBridgeEvent extends BridgeEventContent {
  readonly contentDigest: Sha256Hex;
}
