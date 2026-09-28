/**
 * The published schema surface registry: every public zod validator of
 * the bridge contract, in a deterministic order, plus the CORE record
 * subset published at the `contracts/external-event-bridge` boundary
 * (the W012 public-contract convention).
 */
import type { ZodType } from 'zod';
import {
  BridgeCausalParentSchema,
  BridgeEventContentSchema,
  BridgeEventPayloadSchema,
  BridgeEventSequenceSchema,
  SealedBridgeEventSchema,
} from './events';
import {
  ExternalEventContentSchema,
  ObservationIntakePayloadSchema,
  ObservationIntakeProposalContentSchema,
  SealedExternalEventSchema,
  SealedObservationIntakeProposalSchema,
} from './inbound';
import {
  FilteredOutboundPayloadSchema,
  LeastPrivilegeProjectionSchema,
  OutboundRedactionMarkerSchema,
  OutboundRequestContentSchema,
  ReleasedFieldSchema,
  SealedOutboundRequestSchema,
} from './outbound';
import {
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
} from './delivery';
import {
  ProviderRegistrationContentSchema,
  SealedProviderRegistrationSchema,
} from './provider';
import {
  BridgeAuthorizationDecisionSchema,
  BridgeAuthorizationRequestSchema,
  BridgeResourceReferenceSchema,
} from './authorization';
import { BridgeProvenanceSchema, AdapterIdSchema } from './provenance';

/** One entry of the published schema surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete published schema surface (deterministic order). */
export const EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AdapterId', schema: AdapterIdSchema },
  { type: 'BridgeProvenance', schema: BridgeProvenanceSchema },
  { type: 'BridgeResourceReference', schema: BridgeResourceReferenceSchema },
  { type: 'BridgeAuthorizationRequest', schema: BridgeAuthorizationRequestSchema },
  { type: 'BridgeAuthorizationDecision', schema: BridgeAuthorizationDecisionSchema },
  { type: 'ExternalEventContent', schema: ExternalEventContentSchema },
  { type: 'SealedExternalEvent', schema: SealedExternalEventSchema },
  { type: 'ObservationIntakePayload', schema: ObservationIntakePayloadSchema },
  { type: 'ObservationIntakeProposalContent', schema: ObservationIntakeProposalContentSchema },
  { type: 'SealedObservationIntakeProposal', schema: SealedObservationIntakeProposalSchema },
  { type: 'LeastPrivilegeProjection', schema: LeastPrivilegeProjectionSchema },
  { type: 'ReleasedField', schema: ReleasedFieldSchema },
  { type: 'OutboundRedactionMarker', schema: OutboundRedactionMarkerSchema },
  { type: 'FilteredOutboundPayload', schema: FilteredOutboundPayloadSchema },
  { type: 'OutboundRequestContent', schema: OutboundRequestContentSchema },
  { type: 'SealedOutboundRequest', schema: SealedOutboundRequestSchema },
  { type: 'RetryPolicy', schema: RetryPolicySchema },
  { type: 'DeliveryReceiptContent', schema: DeliveryReceiptContentSchema },
  { type: 'SealedDeliveryReceipt', schema: SealedDeliveryReceiptSchema },
  { type: 'IntakeReceiptContent', schema: IntakeReceiptContentSchema },
  { type: 'SealedIntakeReceipt', schema: SealedIntakeReceiptSchema },
  { type: 'ProviderUnavailableContent', schema: ProviderUnavailableContentSchema },
  { type: 'SealedProviderUnavailable', schema: SealedProviderUnavailableSchema },
  { type: 'ProviderFallbackDirective', schema: ProviderFallbackDirectiveSchema },
  { type: 'ManualQueueRecordContent', schema: ManualQueueRecordContentSchema },
  { type: 'SealedManualQueueRecord', schema: SealedManualQueueRecordSchema },
  { type: 'ProviderRegistrationContent', schema: ProviderRegistrationContentSchema },
  { type: 'SealedProviderRegistration', schema: SealedProviderRegistrationSchema },
  { type: 'BridgeEventSequence', schema: BridgeEventSequenceSchema },
  { type: 'BridgeCausalParent', schema: BridgeCausalParentSchema },
  { type: 'BridgeEventPayload', schema: BridgeEventPayloadSchema },
  { type: 'BridgeEventContent', schema: BridgeEventContentSchema },
  { type: 'SealedBridgeEvent', schema: SealedBridgeEventSchema },
];

/**
 * The CORE record surface published at the
 * `contracts/external-event-bridge` boundary: every sealed record
 * family, its content family, the least-privilege projection reference,
 * the filtered payload, the retry policy, the fallback directive, the
 * provenance block, and the W010-shaped bridge event record.
 */
export const CORE_RECORD_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'BridgeProvenance', schema: BridgeProvenanceSchema },
  { type: 'ExternalEventContent', schema: ExternalEventContentSchema },
  { type: 'SealedExternalEvent', schema: SealedExternalEventSchema },
  { type: 'ObservationIntakePayload', schema: ObservationIntakePayloadSchema },
  { type: 'ObservationIntakeProposalContent', schema: ObservationIntakeProposalContentSchema },
  { type: 'SealedObservationIntakeProposal', schema: SealedObservationIntakeProposalSchema },
  { type: 'LeastPrivilegeProjection', schema: LeastPrivilegeProjectionSchema },
  { type: 'FilteredOutboundPayload', schema: FilteredOutboundPayloadSchema },
  { type: 'OutboundRequestContent', schema: OutboundRequestContentSchema },
  { type: 'SealedOutboundRequest', schema: SealedOutboundRequestSchema },
  { type: 'RetryPolicy', schema: RetryPolicySchema },
  { type: 'DeliveryReceiptContent', schema: DeliveryReceiptContentSchema },
  { type: 'SealedDeliveryReceipt', schema: SealedDeliveryReceiptSchema },
  { type: 'IntakeReceiptContent', schema: IntakeReceiptContentSchema },
  { type: 'SealedIntakeReceipt', schema: SealedIntakeReceiptSchema },
  { type: 'ProviderUnavailableContent', schema: ProviderUnavailableContentSchema },
  { type: 'SealedProviderUnavailable', schema: SealedProviderUnavailableSchema },
  { type: 'ProviderFallbackDirective', schema: ProviderFallbackDirectiveSchema },
  { type: 'ManualQueueRecordContent', schema: ManualQueueRecordContentSchema },
  { type: 'SealedManualQueueRecord', schema: SealedManualQueueRecordSchema },
  { type: 'ProviderRegistrationContent', schema: ProviderRegistrationContentSchema },
  { type: 'SealedProviderRegistration', schema: SealedProviderRegistrationSchema },
  { type: 'BridgeEventContent', schema: BridgeEventContentSchema },
  { type: 'SealedBridgeEvent', schema: SealedBridgeEventSchema },
];
