/**
 * Compile-time conformance assertions for the experience-compiler
 * contract surface.
 *
 * Mirrors `contracts/experience/parity.ts` and
 * `contracts/renderers/parity.ts`: imports both the published
 * declarations (`./index`) and the runtime implementation
 * (`@epoch/experience-compiler`) and asserts strict type identity for
 * every surface type, so the self-contained declarations cannot drift
 * from the zod-inferred implementation types. Compiled by
 * `packages/experience-compiler/tsconfig.contracts.json` as part of
 * `pnpm typecheck`. Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/experience-compiler';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Versions + vocabularies.
export type RenderPlanProtocolVersionParity = Expect<
  Equals<contracts.RenderPlanProtocolVersion, impl.RenderPlanProtocolVersion>
>;
export type ExperienceCompilerDocumentKindParity = Expect<
  Equals<contracts.ExperienceCompilerDocumentKind, impl.ExperienceCompilerDocumentKind>
>;
export type ExperienceCompilerErrorCodeParity = Expect<
  Equals<contracts.ExperienceCompilerErrorCode, impl.ExperienceCompilerErrorCode>
>;
export type PlanStageKindParity = Expect<
  Equals<contracts.PlanStageKind, impl.PlanStageKind>
>;

// Mirrored shared primitive (canonical home: contracts/agent, W003).
export type JsonValueParity = Expect<Equals<contracts.JsonValue, impl.JsonValue>>;

// Neutral primitives (W011 shapes).
export type ColorHexParity = Expect<Equals<contracts.ColorHex, impl.ColorHex>>;
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type ExperienceGraphIdParity = Expect<
  Equals<contracts.ExperienceGraphId, impl.ExperienceGraphId>
>;
export type ExperienceNodeIdParity = Expect<
  Equals<contracts.ExperienceNodeId, impl.ExperienceNodeId>
>;
export type OpaqueScopeIdParity = Expect<Equals<contracts.OpaqueScopeId, impl.OpaqueScopeId>>;
export type TenantScopeParity = Expect<Equals<contracts.TenantScope, impl.TenantScope>>;
export type Vec3Parity = Expect<Equals<contracts.Vec3, impl.Vec3>>;
export type QuaternionParity = Expect<Equals<contracts.Quaternion, impl.Quaternion>>;
export type PresentationAttributesParity = Expect<
  Equals<contracts.PresentationAttributes, impl.PresentationAttributes>
>;

// Projected kernel references.
export type ProjectedWorldEntityRefParity = Expect<
  Equals<contracts.ProjectedWorldEntityRef, impl.ProjectedWorldEntityRef>
>;
export type ProjectedWorldRelationRefParity = Expect<
  Equals<contracts.ProjectedWorldRelationRef, impl.ProjectedWorldRelationRef>
>;
export type ProjectedWorldEventRefParity = Expect<
  Equals<contracts.ProjectedWorldEventRef, impl.ProjectedWorldEventRef>
>;
export type ProjectedAgentRefParity = Expect<
  Equals<contracts.ProjectedAgentRef, impl.ProjectedAgentRef>
>;
export type ProjectedEvidenceRefParity = Expect<
  Equals<contracts.ProjectedEvidenceRef, impl.ProjectedEvidenceRef>
>;
export type ProjectedCapabilityRefParity = Expect<
  Equals<contracts.ProjectedCapabilityRef, impl.ProjectedCapabilityRef>
>;
export type ProjectedReferenceParity = Expect<
  Equals<contracts.ProjectedReference, impl.ProjectedReference>
>;
export type ProjectedReferenceKindParity = Expect<
  Equals<contracts.ProjectedReferenceKind, impl.ProjectedReferenceKind>
>;

// Device descriptor slot.
export type DeviceClassParity = Expect<Equals<contracts.DeviceClass, impl.DeviceClass>>;
export type InteractionModalityParity = Expect<
  Equals<contracts.InteractionModality, impl.InteractionModality>
>;
export type PoseTrackingKindParity = Expect<
  Equals<contracts.PoseTrackingKind, impl.PoseTrackingKind>
>;
export type DeviceDisplayCapabilitiesParity = Expect<
  Equals<contracts.DeviceDisplayCapabilities, impl.DeviceDisplayCapabilities>
>;
export type DeviceSpatialCapabilitiesParity = Expect<
  Equals<contracts.DeviceSpatialCapabilities, impl.DeviceSpatialCapabilities>
>;
export type DeviceDescriptorParity = Expect<
  Equals<contracts.DeviceDescriptor, impl.DeviceDescriptor>
>;

// Reused W011 presentation vocabulary.
export type Point2dParity = Expect<Equals<contracts.Point2d, impl.Point2d>>;
export type Geometry2dParity = Expect<Equals<contracts.Geometry2d, impl.Geometry2d>>;
export type StrokeStyle2dParity = Expect<Equals<contracts.StrokeStyle2d, impl.StrokeStyle2d>>;
export type FillStyle2dParity = Expect<Equals<contracts.FillStyle2d, impl.FillStyle2d>>;
export type MeshBindingParity = Expect<Equals<contracts.MeshBinding, impl.MeshBinding>>;
export type SpatialPrimitiveParity = Expect<
  Equals<contracts.SpatialPrimitive, impl.SpatialPrimitive>
>;
export type TextStyleParity = Expect<Equals<contracts.TextStyle, impl.TextStyle>>;
export type EasingKindParity = Expect<Equals<contracts.EasingKind, impl.EasingKind>>;
export type KeyframeParity = Expect<Equals<contracts.Keyframe, impl.Keyframe>>;
export type TimelineMarkerKindParity = Expect<
  Equals<contracts.TimelineMarkerKind, impl.TimelineMarkerKind>
>;
export type ParticipantKindParity = Expect<
  Equals<contracts.ParticipantKind, impl.ParticipantKind>
>;
export type ParticipantReferenceParity = Expect<
  Equals<contracts.ParticipantReference, impl.ParticipantReference>
>;
export type ControlKindParity = Expect<Equals<contracts.ControlKind, impl.ControlKind>>;
export type ControlIntentParity = Expect<Equals<contracts.ControlIntent, impl.ControlIntent>>;
export type ExperienceEdgeKindParity = Expect<
  Equals<contracts.ExperienceEdgeKind, impl.ExperienceEdgeKind>
>;
export type ExperienceGraphKindParity = Expect<
  Equals<contracts.ExperienceGraphKind, impl.ExperienceGraphKind>
>;

// Compiled plan operations.
export type PlanDrawShapeOpParity = Expect<
  Equals<contracts.PlanDrawShapeOp, impl.PlanDrawShapeOp>
>;
export type PlanDrawLabelOpParity = Expect<
  Equals<contracts.PlanDrawLabelOp, impl.PlanDrawLabelOp>
>;
export type PlanPlaceSpatialOpParity = Expect<
  Equals<contracts.PlanPlaceSpatialOp, impl.PlanPlaceSpatialOp>
>;
export type PlanPlaceLabelOpParity = Expect<
  Equals<contracts.PlanPlaceLabelOp, impl.PlanPlaceLabelOp>
>;
export type PlanAnimationBindingParity = Expect<
  Equals<contracts.PlanAnimationBinding, impl.PlanAnimationBinding>
>;
export type PlanNarrativeBeatParity = Expect<
  Equals<contracts.PlanNarrativeBeat, impl.PlanNarrativeBeat>
>;
export type PlanTimelineTrackParity = Expect<
  Equals<contracts.PlanTimelineTrack, impl.PlanTimelineTrack>
>;
export type PlanTimelineMarkerParity = Expect<
  Equals<contracts.PlanTimelineMarker, impl.PlanTimelineMarker>
>;
export type PlanPresenceSeatParity = Expect<
  Equals<contracts.PlanPresenceSeat, impl.PlanPresenceSeat>
>;
export type PlanPresenceCursorParity = Expect<
  Equals<contracts.PlanPresenceCursor, impl.PlanPresenceCursor>
>;
export type PlanControlOpParity = Expect<Equals<contracts.PlanControlOp, impl.PlanControlOp>>;
export type PlanRelationParity = Expect<Equals<contracts.PlanRelation, impl.PlanRelation>>;
export type PlanStageParity = Expect<Equals<contracts.PlanStage, impl.PlanStage>>;

// Device-shaped constraints and resource usage.
export type PlanConstraintsParity = Expect<
  Equals<contracts.PlanConstraints, impl.PlanConstraints>
>;
export type RenderPlanUsageParity = Expect<
  Equals<contracts.RenderPlanUsage, impl.RenderPlanUsage>
>;

// The Render Plan envelope.
export type RenderPlanContentParity = Expect<
  Equals<contracts.RenderPlanContent, impl.RenderPlanContent>
>;
export type RenderPlanParity = Expect<Equals<contracts.RenderPlan, impl.RenderPlan>>;

// Typed compiler errors.
export type CompilerIssueParity = Expect<Equals<contracts.CompilerIssue, impl.CompilerIssue>>;
export type CompilerErrorParity = Expect<Equals<contracts.CompilerError, impl.CompilerError>>;
