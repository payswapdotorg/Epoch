/**
 * @epoch/external-event-bridge — public API (kernel layer, Work Order W042).
 *
 * The provider-neutral EXTERNAL EVENT/REQUEST BRIDGE (architecture.md
 * "External event bridge"; the provider-neutral integration contract): a
 * pure library — NOTHING runs at import, NOTHING auto-installs, and
 * core project flows work with NO bridge installed (the named
 * no-bridge-operation test).
 *
 * - Normalized INBOUND: typed ExternalEvent records (source adapter
 *   identity, event class, opaque payload, correlation + causation
 *   ids, caller-supplied occurrence instant, W006-shaped provenance)
 *   admitted as W036-shaped observation INTAKE PROPOSALS through the
 *   existing authority path — the bridge NEVER writes observations
 *   directly (`observation-bypass-rejected`).
 * - Normalized OUTBOUND: typed OutboundRequest records with exactly
 *   four classes (information / status / alert /
 *   acknowledgement-request), each payload filtered to least privilege
 *   through a W041 projection-policy typed reference (an unfiltered
 *   send is `least-privilege-violation-rejected`).
 * - Correlation, causation, idempotency (duplicate delivery = the
 *   sealed prior receipt, never a second effect), retry as typed DATA
 *   (caller-supplied instant sequences — no timers) and
 *   content-addressed per-attempt receipts.
 * - Capability discovery + optional-provider semantics: providers
 *   register typed records and are resolved BY CLASS with
 *   deterministic canonical ordering; a missing provider yields a
 *   typed provider-unavailable record with fallback | manual-queue |
 *   alternative-provider outcomes (a second generic provider satisfies
 *   the SAME contract).
 * - Lifecycle-neutral: zero pack-specific branches (the
 *   `pack-branching-rejected` source-scan test); provider vocabulary
 *   never enters this kernel (`provider-vocabulary-rejected` blocklist
 *   test — the W029 pattern).
 * - The `bridge:*` event vocabulary over the W010 event shapes; the
 *   W009 authorization gate before kernel admission; the in-memory
 *   reference host (`./runtime`).
 *
 * Runtime dependency policy (W042 Tech Lead pin, frozen):
 * @epoch/adapter-sdk, @epoch/agent-protocol, @epoch/tenancy, and zod —
 * NOTHING else at runtime. Compatibility with @epoch/event-log (W010
 * event shapes), @epoch/authorization (W009 request/decision shapes),
 * @epoch/access-projection (W041 projection policies), and
 * @epoch/solution-delivery (W036 observation shapes) is exercised via
 * devDependencies + compile-time parity (src/parity.ts) + runtime
 * parity tests — never runtime deps.
 */

// Version + vocabularies.
export {
  BRIDGE_ACTOR_PATTERN,
  BRIDGE_EVENT_DISCRIMINATORS,
  BRIDGE_EVENT_ID_PATTERN,
  BRIDGE_PROVENANCE_KINDS,
  BRIDGE_STREAM_ID_PATTERN,
  CAUSATION_ID_PATTERN,
  CORRELATION_ID_PATTERN,
  DELIVERY_ATTEMPT_OUTCOMES,
  DELIVERY_RECEIPT_ID_PATTERN,
  EXTERNAL_EVENT_BRIDGE_CONTRACT_VERSION,
  EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
  FIELD_TEMPLATE_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
  INBOUND_EVENT_CLASSES,
  INTAKE_PROPOSAL_ID_PATTERN,
  INTAKE_RECEIPT_ID_PATTERN,
  MANUAL_QUEUE_ID_PATTERN,
  OUTBOUND_REQUEST_CLASSES,
  OUTBOUND_REQUEST_ID_PATTERN,
  PROVIDER_FALLBACK_MODES,
  PROVIDER_REGISTRATION_ID_PATTERN,
  PROVIDER_UNAVAILABLE_REASONS,
  RECIPIENT_REF_PATTERN,
  bridgeStreamIdOf,
} from './version';
export type {
  BridgeEventDiscriminator,
  BridgeProvenanceKind,
  DeliveryAttemptOutcome,
  InboundEventClass,
  OutboundRequestClass,
  ProviderFallbackMode,
  ProviderUnavailableReason,
} from './version';

// Published contract types (the NEUTRAL seam).
export type {
  BridgeProvenance,
  AdapterId,
} from './provenance';

export type {
  ExternalEventContent,
  ObservationIntakePayload,
  ObservationIntakeProposalContent,
  SealedExternalEvent,
  SealedObservationIntakeProposal,
  ObservationIntakeContext,
} from './inbound';

export type {
  BridgeRedactionClass,
  FilteredOutboundPayload,
  LeastPrivilegeProjection,
  OutboundLeafEntry,
  OutboundRedactionMarker,
  OutboundRequestContent,
  ReleasedField,
  SealedOutboundRequest,
} from './outbound';

export type {
  DeliveryReceiptContent,
  IntakeReceiptContent,
  ManualQueueRecordContent,
  ProviderFallbackDirective,
  ProviderUnavailableContent,
  RetryPolicy,
  SealedDeliveryReceipt,
  SealedIntakeReceipt,
  SealedManualQueueRecord,
  SealedProviderUnavailable,
} from './delivery';

export type {
  BridgeResourceReference,
  BridgeAuthorizationRequest,
  BridgeAuthorizationDecision,
  BridgeAuthorizationAdmission,
  BridgeAuthorizationGateInput,
} from './authorization';
export type { BridgeActionKind } from './authorization';

export type {
  DeliveryAttemptContext,
  ExternalEventProvider,
  ProviderDeliveryOutcome,
  ProviderDispatchRequest,
  ProviderRegistrationAdmission,
  ProviderRegistrationContent,
  ProviderResolutionInput,
  SealedProviderRegistration,
} from './provider';

export type {
  BridgeCausalParent,
  BridgeEventContent,
  BridgeEventPayload,
  BridgeEventSequence,
  SealedBridgeEvent,
} from './events';
export type {
  FallbackAppliedData,
  IntakeProposedData,
  EventReceivedData,
  ManualQueuedData,
  ProviderRegisteredData,
  ProviderUnavailableData,
  ReceiptRecordedData,
  RequestDispatchedData,
} from './events';

// Typed error taxonomy (values, never thrown).
export type {
  BridgeError,
  BridgeErrorCode,
  BridgeIssue,
  BridgeResult,
} from './errors';

// Provenance.
export {
  ADAPTER_ID_PATTERN,
  AdapterIdSchema,
  BridgeProvenanceSchema,
} from './provenance';

// Runtime validators (the NEUTRAL seam).
export {
  ExternalEventContentSchema,
  ObservationIntakePayloadSchema,
  ObservationIntakeProposalContentSchema,
  SealedExternalEventSchema,
  SealedObservationIntakeProposalSchema,
  buildObservationIntakeProposal,
  computeExternalEventDigest,
  sealExternalEvent,
  verifySealedExternalEvent,
} from './inbound';

export {
  BRIDGE_REDACTION_CLASSES,
  DEFAULT_OUTBOUND_REDACTION_CLASS,
  FilteredOutboundPayloadSchema,
  LeastPrivilegeProjectionSchema,
  OutboundRedactionMarkerSchema,
  OutboundRequestContentSchema,
  ReleasedFieldSchema,
  SealedOutboundRequestSchema,
  buildOutboundRequest,
  computeOutboundRequestDigest,
  filterOutboundPayload,
  sealOutboundRequest,
  templateMatcher,
  verifyLeastPrivilege,
  verifySealedOutboundRequest,
  walkOutboundLeaves,
} from './outbound';

export {
  DeliveryReceiptContentSchema,
  IntakeReceiptContentSchema,
  ManualQueueRecordContentSchema,
  ProviderFallbackDirectiveSchema,
  ProviderUnavailableContentSchema,
  RetryPolicySchema,
  SealedDeliveryReceiptSchema,
  SealedIntakeReceiptSchema,
  SealedManualQueueRecordSchema,
  SealedProviderUnavailableSchema,
  attemptCountOf,
  computeDeliveryReceiptDigest,
  computeIntakeReceiptDigest,
  computeManualQueueRecordDigest,
  computeProviderUnavailableDigest,
  sealDeliveryReceipt,
  sealIntakeReceipt,
  sealManualQueueRecord,
  sealProviderUnavailable,
  verifySealedDeliveryReceipt,
  verifySealedIntakeReceipt,
  verifySealedManualQueueRecord,
  verifySealedProviderUnavailable,
} from './delivery';

export {
  BRIDGE_ACTION_KINDS,
  BridgeAuthorizationDecisionSchema,
  BridgeAuthorizationRequestSchema,
  BridgeResourceReferenceSchema,
  admitBridgeOperation,
  computeBridgeAuthorizationRequestDigest,
} from './authorization';

export {
  ProviderRegistrationContentSchema,
  SealedProviderRegistrationSchema,
  classifyUnavailability,
  deriveProviderRegistrationContent,
  computeProviderRegistrationDigest,
  resolveProvidersByClass,
  sameProviderRegistration,
  sealProviderRegistration,
  verifySealedProviderRegistration,
} from './provider';

export {
  BRIDGE_EVENT_DATA_SCHEMAS,
  BRIDGE_EVENT_RECORD_SCHEMA_NAME,
  BridgeCausalParentSchema,
  BridgeEventContentSchema,
  BridgeEventPayloadSchema,
  BridgeEventSequenceSchema,
  SealedBridgeEventSchema,
  computeBridgeEventDigest,
  parseBridgeEventData,
  sealBridgeEvent,
  verifySealedBridgeEvent,
} from './events';

// Shared primitives.
export {
  BridgePrincipalIdSchema,
  BridgeStreamIdSchema,
  BridgeTenantIdSchema,
  BridgeTimestampSchema,
  CanonicalJsonSchema,
  CausationIdSchema,
  CorrelationIdSchema,
  DeliveryReceiptIdSchema,
  ExternalEventIdSchema,
  FieldTemplateSchema,
  IdempotencyKeySchema,
  IntakeProposalIdSchema,
  IntakeReceiptIdSchema,
  ManualQueueIdSchema,
  OpaquePayloadSchema,
  OutboundRequestIdSchema,
  PositiveIntegerSchema,
  ProviderRegistrationIdSchema,
  RecipientRefSchema,
  Sha256HexSchema,
} from './primitives';
export type {
  BridgeStreamId,
  CausationId,
  CorrelationId,
  ExternalEventId,
  FieldTemplate,
  IdempotencyKey,
  IntakeProposalId,
  IntakeReceiptId,
  ManualQueueId,
  OutboundRequestId,
  DeliveryReceiptId,
  PrincipalId,
  ProviderRegistrationId,
  RecipientRef,
  Sha256Hex,
  TenantId,
  Timestamp,
} from './primitives';

// The runtime reference host (registration, intake, dispatch, receipts,
// the derived bridge-state projection).
export {
  ExternalEventBridgeRuntime,
  bridgeStateDigestOf,
} from './runtime';
export type {
  BridgeAuthorizationPair,
  BridgeProviderView,
  BridgeStateProjection,
  DispatchConclusion,
  DispatchOutboundRequestInput,
  ExternalEventBridgeRuntimeOptions,
  IntakeExternalEventInput,
  IntakeOutcome,
  OutboundDispatchOutcome,
  RegisterProviderInput,
} from './runtime';

// Published schema surface + contract emission.
export {
  EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE,
  CORE_RECORD_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  EXTERNAL_EVENT_BRIDGE_CONTRACT_DIR,
  EXTERNAL_EVENT_BRIDGE_PUBLIC_CONTRACT_DIR,
  renderExternalEventBridgeContractFiles,
  renderExternalEventBridgePublicContractFiles,
  typeToKebabCase,
} from './contract-emission';
