/**
 * Compile-time conformance assertions for the execution-tracking contract
 * surface.
 *
 * Mirrors `contracts/solution-delivery/parity.ts` and
 * `contracts/procurement/parity.ts`: imports both the published
 * declarations (`./index`) and the runtime implementation
 * (`@epoch/execution-tracking`) and asserts strict type identity for
 * every surface type, so the self-contained declarations cannot drift
 * from the zod-inferred implementation types. Compiled by
 * `packages/execution-tracking`'s `typecheck` script
 * (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`.
 * Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/execution-tracking';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Versions + closed vocabularies.
export type TrackingStateParity = Expect<Equals<contracts.TrackingState, impl.TrackingState>>;
export type ResourceKindParity = Expect<Equals<contracts.ResourceKind, impl.ResourceKind>>;
export type FieldEvidenceKindParity = Expect<
  Equals<contracts.FieldEvidenceKind, impl.FieldEvidenceKind>
>;
export type IssueKindParity = Expect<Equals<contracts.IssueKind, impl.IssueKind>>;
export type IssueSeverityParity = Expect<Equals<contracts.IssueSeverity, impl.IssueSeverity>>;
export type ResolutionStateParity = Expect<
  Equals<contracts.ResolutionState, impl.ResolutionState>
>;
export type IssueResolutionDecisionParity = Expect<
  Equals<contracts.IssueResolutionDecision, impl.IssueResolutionDecision>
>;

// Neutral primitives.
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type TenantIdParity = Expect<Equals<contracts.TenantId, impl.TenantId>>;
export type PrincipalIdParity = Expect<Equals<contracts.PrincipalId, impl.PrincipalId>>;
export type SolutionIdParity = Expect<Equals<contracts.SolutionId, impl.SolutionId>>;
export type WorkPackageIdParity = Expect<Equals<contracts.WorkPackageId, impl.WorkPackageId>>;
export type ActivityIdParity = Expect<Equals<contracts.ActivityId, impl.ActivityId>>;
export type MilestoneIdParity = Expect<Equals<contracts.MilestoneId, impl.MilestoneId>>;
export type DeliveryIdParity = Expect<Equals<contracts.DeliveryId, impl.DeliveryId>>;
export type StateIdParity = Expect<Equals<contracts.StateId, impl.StateId>>;
export type ResourceObservationIdParity = Expect<
  Equals<contracts.ResourceObservationId, impl.ResourceObservationId>
>;
export type EvidenceLinkIdParity = Expect<Equals<contracts.EvidenceLinkId, impl.EvidenceLinkId>>;
export type IssueRecordIdParity = Expect<Equals<contracts.IssueRecordId, impl.IssueRecordId>>;
export type IssueResolutionIdParity = Expect<
  Equals<contracts.IssueResolutionId, impl.IssueResolutionId>
>;
export type ReconciliationIdParity = Expect<
  Equals<contracts.ReconciliationId, impl.ReconciliationId>
>;
export type FieldCaptureKeyParity = Expect<
  Equals<contracts.FieldCaptureKey, impl.FieldCaptureKey>
>;
export type ExecutionStreamIdParity = Expect<
  Equals<contracts.ExecutionStreamId, impl.ExecutionStreamId>
>;

// Shared W036 mirrors.
export type UncertaintyStateParity = Expect<
  Equals<contracts.UncertaintyState, impl.UncertaintyState>
>;
export type MeasureParity = Expect<Equals<contracts.Measure, impl.Measure>>;

// Field evidence references.
export type FieldEvidenceLinkParity = Expect<
  Equals<contracts.FieldEvidenceLink, impl.FieldEvidenceLink>
>;
export type FieldEvidenceLinkRecordContentParity = Expect<
  Equals<contracts.FieldEvidenceLinkRecordContent, impl.FieldEvidenceLinkRecordContent>
>;
export type SealedFieldEvidenceLinkParity = Expect<
  Equals<contracts.SealedFieldEvidenceLink, impl.SealedFieldEvidenceLink>
>;

// Tracking states.
export type TrackingSubjectParity = Expect<
  Equals<contracts.TrackingSubject, impl.TrackingSubject>
>;
export type TrackingStateRecordContentParity = Expect<
  Equals<contracts.TrackingStateRecordContent, impl.TrackingStateRecordContent>
>;
export type SealedTrackingStateRecordParity = Expect<
  Equals<contracts.SealedTrackingStateRecord, impl.SealedTrackingStateRecord>
>;

// Resource observations.
export type ResourceObservationContentParity = Expect<
  Equals<contracts.ResourceObservationContent, impl.ResourceObservationContent>
>;
export type SealedResourceObservationParity = Expect<
  Equals<contracts.SealedResourceObservation, impl.SealedResourceObservation>
>;

// Issue families.
export type IssueImpactParity = Expect<Equals<contracts.IssueImpact, impl.IssueImpact>>;
export type ReworkReferenceParity = Expect<
  Equals<contracts.ReworkReference, impl.ReworkReference>
>;
export type BlockerSemanticsParity = Expect<
  Equals<contracts.BlockerSemantics, impl.BlockerSemantics>
>;
export type IssueRecordContentParity = Expect<
  Equals<contracts.IssueRecordContent, impl.IssueRecordContent>
>;
export type SealedIssueRecordParity = Expect<
  Equals<contracts.SealedIssueRecord, impl.SealedIssueRecord>
>;
export type IssueResolutionContentParity = Expect<
  Equals<contracts.IssueResolutionContent, impl.IssueResolutionContent>
>;
export type SealedIssueResolutionParity = Expect<
  Equals<contracts.SealedIssueResolution, impl.SealedIssueResolution>
>;

// Reconciliation.
export type ReconciliationEntryParity = Expect<
  Equals<contracts.ReconciliationEntry, impl.ReconciliationEntry>
>;
export type ReconciliationProposalContentParity = Expect<
  Equals<contracts.ReconciliationProposalContent, impl.ReconciliationProposalContent>
>;
export type SealedReconciliationProposalParity = Expect<
  Equals<contracts.SealedReconciliationProposal, impl.SealedReconciliationProposal>
>;

// The low-friction field capture.
export type CaptureSubjectParity = Expect<
  Equals<contracts.CaptureSubject, impl.CaptureSubject>
>;
export type CaptureResourceUsageParity = Expect<
  Equals<contracts.CaptureResourceUsage, impl.CaptureResourceUsage>
>;
export type FieldCaptureParity = Expect<Equals<contracts.FieldCapture, impl.FieldCapture>>;

// Events (the W010 mirror).
export type ExecutionEventSequenceParity = Expect<
  Equals<contracts.ExecutionEventSequence, impl.ExecutionEventSequence>
>;
export type ExecutionCausalParentParity = Expect<
  Equals<contracts.ExecutionCausalParent, impl.ExecutionCausalParent>
>;
export type ExecutionEventPayloadParity = Expect<
  Equals<contracts.ExecutionEventPayload, impl.ExecutionEventPayload>
>;
export type ExecutionEventContentParity = Expect<
  Equals<contracts.ExecutionEventContent, impl.ExecutionEventContent>
>;
export type SealedExecutionEventParity = Expect<
  Equals<contracts.SealedExecutionEvent, impl.SealedExecutionEvent>
>;
