/**
 * Compile-time conformance assertions for the external-event-bridge
 * contract surface.
 *
 * Mirrors `contracts/solution-delivery/parity.ts` and
 * `contracts/access-projection/parity.ts`: imports both the published
 * declarations (`./index`) and the runtime implementation
 * (`@epoch/external-event-bridge`) and asserts strict type identity for
 * every core surface type, so the self-contained declarations cannot
 * drift from the zod-inferred implementation types. Compiled by
 * `packages/external-event-bridge`'s `typecheck` script
 * (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`.
 * Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/external-event-bridge';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Neutral primitives (JsonValue is the shared protocol grammar, not a bridge-owned type).
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type TenantIdParity = Expect<Equals<contracts.TenantId, impl.TenantId>>;
export type PrincipalIdParity = Expect<Equals<contracts.PrincipalId, impl.PrincipalId>>;
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type AdapterIdParity = Expect<Equals<contracts.AdapterId, impl.AdapterId>>;
export type ExternalEventIdParity = Expect<Equals<contracts.ExternalEventId, impl.ExternalEventId>>;
export type IntakeProposalIdParity = Expect<
  Equals<contracts.IntakeProposalId, impl.IntakeProposalId>
>;
export type OutboundRequestIdParity = Expect<
  Equals<contracts.OutboundRequestId, impl.OutboundRequestId>
>;
export type ProviderRegistrationIdParity = Expect<
  Equals<contracts.ProviderRegistrationId, impl.ProviderRegistrationId>
>;
export type DeliveryReceiptIdParity = Expect<
  Equals<contracts.DeliveryReceiptId, impl.DeliveryReceiptId>
>;
export type IntakeReceiptIdParity = Expect<Equals<contracts.IntakeReceiptId, impl.IntakeReceiptId>>;
export type ManualQueueIdParity = Expect<Equals<contracts.ManualQueueId, impl.ManualQueueId>>;
export type CorrelationIdParity = Expect<Equals<contracts.CorrelationId, impl.CorrelationId>>;
export type CausationIdParity = Expect<Equals<contracts.CausationId, impl.CausationId>>;
export type IdempotencyKeyParity = Expect<Equals<contracts.IdempotencyKey, impl.IdempotencyKey>>;
export type RecipientRefParity = Expect<Equals<contracts.RecipientRef, impl.RecipientRef>>;
export type FieldTemplateParity = Expect<Equals<contracts.FieldTemplate, impl.FieldTemplate>>;
export type BridgeStreamIdParity = Expect<Equals<contracts.BridgeStreamId, impl.BridgeStreamId>>;

// Versions + closed vocabularies.
export type InboundEventClassParity = Expect<
  Equals<contracts.InboundEventClass, impl.InboundEventClass>
>;
export type OutboundRequestClassParity = Expect<
  Equals<contracts.OutboundRequestClass, impl.OutboundRequestClass>
>;
export type ProviderFallbackModeParity = Expect<
  Equals<contracts.ProviderFallbackMode, impl.ProviderFallbackMode>
>;
export type ProviderUnavailableReasonParity = Expect<
  Equals<contracts.ProviderUnavailableReason, impl.ProviderUnavailableReason>
>;
export type DeliveryAttemptOutcomeParity = Expect<
  Equals<contracts.DeliveryAttemptOutcome, impl.DeliveryAttemptOutcome>
>;
export type BridgeProvenanceKindParity = Expect<
  Equals<contracts.BridgeProvenanceKind, impl.BridgeProvenanceKind>
>;
export type BridgeRedactionClassParity = Expect<
  Equals<contracts.BridgeRedactionClass, impl.BridgeRedactionClass>
>;
export type BridgeEventDiscriminatorParity = Expect<
  Equals<contracts.BridgeEventDiscriminator, impl.BridgeEventDiscriminator>
>;

// The W007 adapter-descriptor mirror (the SDK shapes, structural).
export type CapabilityCategoryParity = Expect<
  Equals<contracts.CapabilityCategory, impl.ProviderRegistrationContent['adapterDescriptor']['category']>
>;
export type CapabilityBindingParity = Expect<
  Equals<contracts.CapabilityBinding, impl.ProviderRegistrationContent['capabilityBinding']>
>;
export type AdapterDescriptorParity = Expect<
  Equals<contracts.AdapterDescriptor, impl.ProviderRegistrationContent['adapterDescriptor']>
>;

// The W009 authorization gate mirrors.
export type BridgeResourceReferenceParity = Expect<
  Equals<contracts.BridgeResourceReference, impl.BridgeResourceReference>
>;
export type BridgeAuthorizationRequestParity = Expect<
  Equals<contracts.BridgeAuthorizationRequest, impl.BridgeAuthorizationRequest>
>;
export type BridgeAuthorizationDecisionParity = Expect<
  Equals<contracts.BridgeAuthorizationDecision, impl.BridgeAuthorizationDecision>
>;

// Provenance + the normalized inbound contract.
export type BridgeProvenanceParity = Expect<
  Equals<contracts.BridgeProvenance, impl.BridgeProvenance>
>;
export type ExternalEventContentParity = Expect<
  Equals<contracts.ExternalEventContent, impl.ExternalEventContent>
>;
export type SealedExternalEventParity = Expect<
  Equals<contracts.SealedExternalEvent, impl.SealedExternalEvent>
>;
export type ObservationIntakePayloadParity = Expect<
  Equals<contracts.ObservationIntakePayload, impl.ObservationIntakePayload>
>;
export type ObservationIntakeProposalContentParity = Expect<
  Equals<contracts.ObservationIntakeProposalContent, impl.ObservationIntakeProposalContent>
>;
export type SealedObservationIntakeProposalParity = Expect<
  Equals<contracts.SealedObservationIntakeProposal, impl.SealedObservationIntakeProposal>
>;

// The normalized outbound contract.
export type LeastPrivilegeProjectionParity = Expect<
  Equals<contracts.LeastPrivilegeProjection, impl.LeastPrivilegeProjection>
>;
export type ReleasedFieldParity = Expect<Equals<contracts.ReleasedField, impl.ReleasedField>>;
export type OutboundRedactionMarkerParity = Expect<
  Equals<contracts.OutboundRedactionMarker, impl.OutboundRedactionMarker>
>;
export type FilteredOutboundPayloadParity = Expect<
  Equals<contracts.FilteredOutboundPayload, impl.FilteredOutboundPayload>
>;
export type OutboundRequestContentParity = Expect<
  Equals<contracts.OutboundRequestContent, impl.OutboundRequestContent>
>;
export type SealedOutboundRequestParity = Expect<
  Equals<contracts.SealedOutboundRequest, impl.SealedOutboundRequest>
>;

// Retry, receipts, unavailability, fallback, manual queue.
export type RetryPolicyParity = Expect<Equals<contracts.RetryPolicy, impl.RetryPolicy>>;
export type DeliveryReceiptContentParity = Expect<
  Equals<contracts.DeliveryReceiptContent, impl.DeliveryReceiptContent>
>;
export type SealedDeliveryReceiptParity = Expect<
  Equals<contracts.SealedDeliveryReceipt, impl.SealedDeliveryReceipt>
>;
export type IntakeReceiptContentParity = Expect<
  Equals<contracts.IntakeReceiptContent, impl.IntakeReceiptContent>
>;
export type SealedIntakeReceiptParity = Expect<
  Equals<contracts.SealedIntakeReceipt, impl.SealedIntakeReceipt>
>;
export type ProviderUnavailableContentParity = Expect<
  Equals<contracts.ProviderUnavailableContent, impl.ProviderUnavailableContent>
>;
export type SealedProviderUnavailableParity = Expect<
  Equals<contracts.SealedProviderUnavailable, impl.SealedProviderUnavailable>
>;
export type ProviderFallbackDirectiveParity = Expect<
  Equals<contracts.ProviderFallbackDirective, impl.ProviderFallbackDirective>
>;
export type ManualQueueRecordContentParity = Expect<
  Equals<contracts.ManualQueueRecordContent, impl.ManualQueueRecordContent>
>;
export type SealedManualQueueRecordParity = Expect<
  Equals<contracts.SealedManualQueueRecord, impl.SealedManualQueueRecord>
>;

// The provider registration.
export type ProviderRegistrationContentParity = Expect<
  Equals<contracts.ProviderRegistrationContent, impl.ProviderRegistrationContent>
>;
export type SealedProviderRegistrationParity = Expect<
  Equals<contracts.SealedProviderRegistration, impl.SealedProviderRegistration>
>;

// The bridge:* lifecycle events (W010-shaped).
export type BridgeEventSequenceParity = Expect<
  Equals<contracts.BridgeEventSequence, impl.BridgeEventSequence>
>;
export type BridgeCausalParentParity = Expect<
  Equals<contracts.BridgeCausalParent, impl.BridgeCausalParent>
>;
export type BridgeEventPayloadParity = Expect<
  Equals<contracts.BridgeEventPayload, impl.BridgeEventPayload>
>;
export type BridgeEventContentParity = Expect<
  Equals<contracts.BridgeEventContent, impl.BridgeEventContent>
>;
export type SealedBridgeEventParity = Expect<
  Equals<contracts.SealedBridgeEvent, impl.SealedBridgeEvent>
>;
