/**
 * Compile-time conformance assertions for the experience contract surface.
 *
 * Mirrors `contracts/agent/parity.ts` and `contracts/actions/parity.ts`:
 * imports both the published declarations (`./index`) and the runtime
 * implementation (`@epoch/experience-protocol`) and asserts strict type
 * identity for every surface type, so the self-contained declarations
 * cannot drift from the zod-inferred implementation types. Compiled by
 * `packages/experience-protocol/tsconfig.contracts.json` as part of
 * `pnpm typecheck`. Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/experience-protocol';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Versions + vocabularies.
export type ExperienceProtocolVersionParity = Expect<
  Equals<contracts.ExperienceProtocolVersion, impl.ExperienceProtocolVersion>
>;
export type ExperienceGraphKindParity = Expect<
  Equals<contracts.ExperienceGraphKind, impl.ExperienceGraphKind>
>;
export type ExperienceNodeKindParity = Expect<
  Equals<contracts.ExperienceNodeKind, impl.ExperienceNodeKind>
>;
export type ExperienceEdgeKindParity = Expect<
  Equals<contracts.ExperienceEdgeKind, impl.ExperienceEdgeKind>
>;
export type ExperienceErrorCodeParity = Expect<
  Equals<contracts.ExperienceErrorCode, impl.ExperienceErrorCode>
>;
export type ProjectedReferenceKindParity = Expect<
  Equals<contracts.ProjectedReferenceKind, impl.ProjectedReferenceKind>
>;
export type DeviceClassParity = Expect<Equals<contracts.DeviceClass, impl.DeviceClass>>;
export type InteractionModalityParity = Expect<
  Equals<contracts.InteractionModality, impl.InteractionModality>
>;
export type PoseTrackingKindParity = Expect<
  Equals<contracts.PoseTrackingKind, impl.PoseTrackingKind>
>;
export type SpatialPrimitiveParity = Expect<
  Equals<contracts.SpatialPrimitive, impl.SpatialPrimitive>
>;
export type ControlKindParity = Expect<Equals<contracts.ControlKind, impl.ControlKind>>;
export type ParticipantKindParity = Expect<
  Equals<contracts.ParticipantKind, impl.ParticipantKind>
>;
export type EasingKindParity = Expect<Equals<contracts.EasingKind, impl.EasingKind>>;
export type TimelineMarkerKindParity = Expect<
  Equals<contracts.TimelineMarkerKind, impl.TimelineMarkerKind>
>;
export type NarrativeToneParity = Expect<Equals<contracts.NarrativeTone, impl.NarrativeTone>>;
export type TextWeightParity = Expect<Equals<contracts.TextWeight, impl.TextWeight>>;

// Mirrored shared primitive (canonical home: contracts/agent, W003).
export type JsonValueParity = Expect<Equals<contracts.JsonValue, impl.JsonValue>>;

// Neutral primitives.
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type ExperienceNodeIdParity = Expect<
  Equals<contracts.ExperienceNodeId, impl.ExperienceNodeId>
>;
export type ExperienceGraphIdParity = Expect<
  Equals<contracts.ExperienceGraphId, impl.ExperienceGraphId>
>;
export type OpaqueScopeIdParity = Expect<Equals<contracts.OpaqueScopeId, impl.OpaqueScopeId>>;
export type TenantScopeParity = Expect<Equals<contracts.TenantScope, impl.TenantScope>>;
export type ColorHexParity = Expect<Equals<contracts.ColorHex, impl.ColorHex>>;
export type Vec3Parity = Expect<Equals<contracts.Vec3, impl.Vec3>>;
export type QuaternionParity = Expect<Equals<contracts.Quaternion, impl.Quaternion>>;
export type PropertyPathParity = Expect<Equals<contracts.PropertyPath, impl.PropertyPath>>;
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

// Device descriptor slot.
export type DeviceDisplayCapabilitiesParity = Expect<
  Equals<contracts.DeviceDisplayCapabilities, impl.DeviceDisplayCapabilities>
>;
export type DeviceSpatialCapabilitiesParity = Expect<
  Equals<contracts.DeviceSpatialCapabilities, impl.DeviceSpatialCapabilities>
>;
export type DeviceDescriptorParity = Expect<
  Equals<contracts.DeviceDescriptor, impl.DeviceDescriptor>
>;

// Typed presentation descriptors.
export type Point2dParity = Expect<Equals<contracts.Point2d, impl.Point2d>>;
export type Geometry2dParity = Expect<Equals<contracts.Geometry2d, impl.Geometry2d>>;
export type StrokeStyle2dParity = Expect<Equals<contracts.StrokeStyle2d, impl.StrokeStyle2d>>;
export type FillStyle2dParity = Expect<Equals<contracts.FillStyle2d, impl.FillStyle2d>>;
export type Shape2dDescriptorParity = Expect<
  Equals<contracts.Shape2dDescriptor, impl.Shape2dDescriptor>
>;
export type MeshBindingParity = Expect<Equals<contracts.MeshBinding, impl.MeshBinding>>;
export type Spatial3dDescriptorParity = Expect<
  Equals<contracts.Spatial3dDescriptor, impl.Spatial3dDescriptor>
>;
export type TextStyleParity = Expect<Equals<contracts.TextStyle, impl.TextStyle>>;
export type LabelDescriptorParity = Expect<
  Equals<contracts.LabelDescriptor, impl.LabelDescriptor>
>;
export type KeyframeParity = Expect<Equals<contracts.Keyframe, impl.Keyframe>>;
export type AnimationTrackParity = Expect<
  Equals<contracts.AnimationTrack, impl.AnimationTrack>
>;
export type AnimationClipDescriptorParity = Expect<
  Equals<contracts.AnimationClipDescriptor, impl.AnimationClipDescriptor>
>;
export type NarrativeBeatDescriptorParity = Expect<
  Equals<contracts.NarrativeBeatDescriptor, impl.NarrativeBeatDescriptor>
>;
export type TimelineTrackDescriptorParity = Expect<
  Equals<contracts.TimelineTrackDescriptor, impl.TimelineTrackDescriptor>
>;
export type TimelineMarkerDescriptorParity = Expect<
  Equals<contracts.TimelineMarkerDescriptor, impl.TimelineMarkerDescriptor>
>;
export type ParticipantReferenceParity = Expect<
  Equals<contracts.ParticipantReference, impl.ParticipantReference>
>;
export type PresenceSeatDescriptorParity = Expect<
  Equals<contracts.PresenceSeatDescriptor, impl.PresenceSeatDescriptor>
>;
export type PresenceCursorDescriptorParity = Expect<
  Equals<contracts.PresenceCursorDescriptor, impl.PresenceCursorDescriptor>
>;
export type ControlIntentParity = Expect<Equals<contracts.ControlIntent, impl.ControlIntent>>;
export type ControlDescriptorParity = Expect<
  Equals<contracts.ControlDescriptor, impl.ControlDescriptor>
>;

// Experience Graph envelope.
export type ExperienceNodeParity = Expect<
  Equals<contracts.ExperienceNode, impl.ExperienceNode>
>;
export type ExperienceEdgeParity = Expect<
  Equals<contracts.ExperienceEdge, impl.ExperienceEdge>
>;
export type ExperienceGraphContentParity = Expect<
  Equals<contracts.ExperienceGraphContent, impl.ExperienceGraphContent>
>;
export type ExperienceGraphParity = Expect<
  Equals<contracts.ExperienceGraph, impl.ExperienceGraph>
>;

// Projection requests.
export type ReplayWindowParity = Expect<Equals<contracts.ReplayWindow, impl.ReplayWindow>>;
export type ProjectionRequestParity = Expect<
  Equals<contracts.ProjectionRequest, impl.ProjectionRequest>
>;

// Typed admission errors.
export type ExperienceIssueParity = Expect<
  Equals<contracts.ExperienceIssue, impl.ExperienceIssue>
>;
export type ExperienceProtocolErrorParity = Expect<
  Equals<contracts.ExperienceProtocolError, impl.ExperienceProtocolError>
>;
