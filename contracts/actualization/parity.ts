/**
 * Compile-time conformance assertions for the actualization contract
 * surface.
 *
 * Mirrors `contracts/solution-delivery/parity.ts` and
 * `contracts/execution/parity.ts`: imports both the published
 * declarations (`./index`) and the runtime implementation
 * (`@epoch/actualization`) and asserts strict type identity for every
 * surface type, so the self-contained declarations cannot drift from the
 * zod-inferred implementation types. Compiled by
 * `packages/actualization`'s `typecheck` script (`tsconfig.contracts.json`);
 * any drift fails `pnpm typecheck`. Verification-only; no runtime
 * dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/actualization';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Versions + closed vocabularies.
export type ValidationStateParity = Expect<Equals<contracts.ValidationState, impl.ValidationState>>;
export type ReconciliationModeParity = Expect<
  Equals<contracts.ReconciliationMode, impl.ReconciliationMode>
>;
export type ReconciliationFoldModeParity = Expect<
  Equals<contracts.ReconciliationFoldMode, impl.ReconciliationFoldMode>
>;
export type LineageNodeKindParity = Expect<
  Equals<contracts.LineageNodeKind, impl.LineageNodeKind>
>;
export type ForecastBiasDirectionParity = Expect<
  Equals<contracts.ForecastBiasDirection, impl.ForecastBiasDirection>
>;
export type ActualizationEventDiscriminatorParity = Expect<
  Equals<contracts.ActualizationEventDiscriminator, impl.ActualizationEventDiscriminator>
>;
export type ValidationMeasureKindParity = Expect<
  Equals<contracts.ValidationMeasureKind, impl.ValidationMeasureKind>
>;

// Neutral primitives.
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type TenantIdParity = Expect<Equals<contracts.TenantId, impl.TenantId>>;
export type PrincipalIdParity = Expect<Equals<contracts.PrincipalId, impl.PrincipalId>>;
export type SolutionIdParity = Expect<Equals<contracts.SolutionId, impl.SolutionId>>;
export type DeliveryIdParity = Expect<Equals<contracts.DeliveryId, impl.DeliveryId>>;
export type NonNegativeDecimalParity = Expect<
  Equals<contracts.NonNegativeDecimal, impl.NonNegativeDecimal>
>;

// The composed W036 grammars.
export type DistinctionSubjectParity = Expect<
  Equals<contracts.DistinctionSubject, impl.DistinctionSubject>
>;
export type MeasureParity = Expect<Equals<contracts.Measure, impl.Measure>>;
export type UncertaintyStateParity = Expect<
  Equals<contracts.UncertaintyState, impl.UncertaintyState>
>;

// Exact-revision reference grammars.
export type ObservationReferenceParity = Expect<
  Equals<contracts.ObservationReference, impl.ObservationReference>
>;
export type AssessmentReferenceParity = Expect<
  Equals<contracts.AssessmentReference, impl.AssessmentReference>
>;

// The reconciliation policy.
export type ReconciliationPolicyParity = Expect<
  Equals<contracts.ReconciliationPolicy, impl.ReconciliationPolicy>
>;

// Validation assessments + conflict resolutions.
export type ValidationAssessmentContentParity = Expect<
  Equals<contracts.ValidationAssessmentContent, impl.ValidationAssessmentContent>
>;
export type SealedValidationAssessmentParity = Expect<
  Equals<contracts.SealedValidationAssessment, impl.SealedValidationAssessment>
>;
export type ConflictResolutionContentParity = Expect<
  Equals<contracts.ConflictResolutionContent, impl.ConflictResolutionContent>
>;
export type SealedConflictResolutionParity = Expect<
  Equals<contracts.SealedConflictResolution, impl.SealedConflictResolution>
>;

// Lineage.
export type LineageNodeRefParity = Expect<
  Equals<contracts.LineageNodeRef, impl.LineageNodeRef>
>;
export type LineageEdgeContentParity = Expect<
  Equals<contracts.LineageEdgeContent, impl.LineageEdgeContent>
>;
export type SealedLineageEdgeParity = Expect<
  Equals<contracts.SealedLineageEdge, impl.SealedLineageEdge>
>;

// Comparison facts + calibration states.
export type ComparisonRecordReferenceParity = Expect<
  Equals<contracts.ComparisonRecordReference, impl.ComparisonRecordReference>
>;
export type ForecastSideReferenceParity = Expect<
  Equals<contracts.ForecastSideReference, impl.ForecastSideReference>
>;
export type ActualSideReferenceParity = Expect<
  Equals<contracts.ActualSideReference, impl.ActualSideReference>
>;
export type ComparisonFactContentParity = Expect<
  Equals<contracts.ComparisonFactContent, impl.ComparisonFactContent>
>;
export type SealedComparisonFactParity = Expect<
  Equals<contracts.SealedComparisonFact, impl.SealedComparisonFact>
>;
export type CalibrationConfidenceParity = Expect<
  Equals<contracts.CalibrationConfidence, impl.CalibrationConfidence>
>;
export type CalibrationStateContentParity = Expect<
  Equals<contracts.CalibrationStateContent, impl.CalibrationStateContent>
>;
export type SealedCalibrationStateParity = Expect<
  Equals<contracts.SealedCalibrationState, impl.SealedCalibrationState>
>;

// The actualization:* events over the W010 event shapes.
export type ActualizationEventSequenceParity = Expect<
  Equals<contracts.ActualizationEventSequence, impl.ActualizationEventSequence>
>;
export type ActualizationCausalParentParity = Expect<
  Equals<contracts.ActualizationCausalParent, impl.ActualizationCausalParent>
>;
export type ActualizationEventPayloadParity = Expect<
  Equals<contracts.ActualizationEventPayload, impl.ActualizationEventPayload>
>;
export type ActualizationEventContentParity = Expect<
  Equals<contracts.ActualizationEventContent, impl.ActualizationEventContent>
>;
export type SealedActualizationEventParity = Expect<
  Equals<contracts.SealedActualizationEvent, impl.SealedActualizationEvent>
>;
