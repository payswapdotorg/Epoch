/**
 * The experience-protocol schema surface registry: every data type
 * published at the `contracts/experience` boundary, paired with its zod
 * schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`):
 * - every entry is exported from the package index;
 * - every entry has a declaration in `contracts/experience/index.d.ts`;
 * - every entry has a compile-time parity assertion in
 *   `contracts/experience/parity.ts`;
 * - every entry has an emitted JSON Schema file listed in
 *   `contracts/experience/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import { JsonValueSchema } from '@epoch/agent-protocol';
import {
  ExperienceProtocolVersionSchema,
  ExperienceGraphKindSchema,
  ExperienceNodeKindSchema,
  ExperienceEdgeKindSchema,
  ExperienceErrorCodeSchema,
  ProjectedReferenceKindSchema,
  DeviceClassSchema,
  InteractionModalitySchema,
  PoseTrackingKindSchema,
  SpatialPrimitiveSchema,
  ControlKindSchema,
  ParticipantKindSchema,
  EasingKindSchema,
  TimelineMarkerKindSchema,
  NarrativeToneSchema,
  TextWeightSchema,
} from './version';
import {
  Sha256HexSchema,
  ExperienceNodeIdSchema,
  ExperienceGraphIdSchema,
  OpaqueScopeIdSchema,
  TenantScopeSchema,
  ColorHexSchema,
  Vec3Schema,
  QuaternionSchema,
  PropertyPathSchema,
  PresentationAttributesSchema,
} from './primitives';
import {
  ProjectedWorldEntityRefSchema,
  ProjectedWorldRelationRefSchema,
  ProjectedWorldEventRefSchema,
  ProjectedAgentRefSchema,
  ProjectedEvidenceRefSchema,
  ProjectedCapabilityRefSchema,
  ProjectedReferenceSchema,
} from './reference';
import {
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  DeviceDescriptorSchema,
} from './device';
import {
  Point2dSchema,
  Geometry2dSchema,
  StrokeStyle2dSchema,
  FillStyle2dSchema,
  Shape2dDescriptorSchema,
  MeshBindingSchema,
  Spatial3dDescriptorSchema,
  TextStyleSchema,
  LabelDescriptorSchema,
  KeyframeSchema,
  AnimationTrackSchema,
  AnimationClipDescriptorSchema,
  NarrativeBeatDescriptorSchema,
  TimelineTrackDescriptorSchema,
  TimelineMarkerDescriptorSchema,
  ParticipantReferenceSchema,
  PresenceSeatDescriptorSchema,
  PresenceCursorDescriptorSchema,
  ControlIntentSchema,
  ControlDescriptorSchema,
} from './descriptors';
import {
  ExperienceNodeSchema,
  ExperienceEdgeSchema,
  ExperienceGraphContentSchema,
  ExperienceGraphSchema,
} from './graph';
import { ReplayWindowSchema, ProjectionRequestSchema } from './request';
import { ExperienceIssueSchema, ExperienceProtocolErrorSchema } from './errors';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/**
 * The complete, ordered data-type surface of experience protocol v1
 * (sorted by type name ascending — the manifest inventory order).
 */
export const EXPERIENCE_PROTOCOL_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AnimationClipDescriptor', schema: AnimationClipDescriptorSchema },
  { type: 'AnimationTrack', schema: AnimationTrackSchema },
  { type: 'ColorHex', schema: ColorHexSchema },
  { type: 'ControlDescriptor', schema: ControlDescriptorSchema },
  { type: 'ControlIntent', schema: ControlIntentSchema },
  { type: 'ControlKind', schema: ControlKindSchema },
  { type: 'DeviceClass', schema: DeviceClassSchema },
  { type: 'DeviceDescriptor', schema: DeviceDescriptorSchema },
  { type: 'DeviceDisplayCapabilities', schema: DeviceDisplayCapabilitiesSchema },
  { type: 'DeviceSpatialCapabilities', schema: DeviceSpatialCapabilitiesSchema },
  { type: 'EasingKind', schema: EasingKindSchema },
  { type: 'ExperienceEdge', schema: ExperienceEdgeSchema },
  { type: 'ExperienceEdgeKind', schema: ExperienceEdgeKindSchema },
  { type: 'ExperienceErrorCode', schema: ExperienceErrorCodeSchema },
  { type: 'ExperienceGraph', schema: ExperienceGraphSchema },
  { type: 'ExperienceGraphContent', schema: ExperienceGraphContentSchema },
  { type: 'ExperienceGraphId', schema: ExperienceGraphIdSchema },
  { type: 'ExperienceGraphKind', schema: ExperienceGraphKindSchema },
  { type: 'ExperienceIssue', schema: ExperienceIssueSchema },
  { type: 'ExperienceNode', schema: ExperienceNodeSchema },
  { type: 'ExperienceNodeId', schema: ExperienceNodeIdSchema },
  { type: 'ExperienceNodeKind', schema: ExperienceNodeKindSchema },
  { type: 'ExperienceProtocolError', schema: ExperienceProtocolErrorSchema },
  { type: 'ExperienceProtocolVersion', schema: ExperienceProtocolVersionSchema },
  { type: 'FillStyle2d', schema: FillStyle2dSchema },
  { type: 'Geometry2d', schema: Geometry2dSchema },
  { type: 'InteractionModality', schema: InteractionModalitySchema },
  // Mirrored shared primitive (canonical home: contracts/agent, W003) —
  // redeclared self-contained in contracts/experience/index.d.ts, exactly
  // as contracts/actions mirrors Timestamp/MessageId/AgentId/JsonValue.
  { type: 'JsonValue', schema: JsonValueSchema },
  { type: 'Keyframe', schema: KeyframeSchema },
  { type: 'LabelDescriptor', schema: LabelDescriptorSchema },
  { type: 'MeshBinding', schema: MeshBindingSchema },
  { type: 'NarrativeBeatDescriptor', schema: NarrativeBeatDescriptorSchema },
  { type: 'NarrativeTone', schema: NarrativeToneSchema },
  { type: 'OpaqueScopeId', schema: OpaqueScopeIdSchema },
  { type: 'ParticipantKind', schema: ParticipantKindSchema },
  { type: 'ParticipantReference', schema: ParticipantReferenceSchema },
  { type: 'Point2d', schema: Point2dSchema },
  { type: 'PoseTrackingKind', schema: PoseTrackingKindSchema },
  { type: 'PresenceCursorDescriptor', schema: PresenceCursorDescriptorSchema },
  { type: 'PresenceSeatDescriptor', schema: PresenceSeatDescriptorSchema },
  { type: 'PresentationAttributes', schema: PresentationAttributesSchema },
  { type: 'ProjectedAgentRef', schema: ProjectedAgentRefSchema },
  { type: 'ProjectedCapabilityRef', schema: ProjectedCapabilityRefSchema },
  { type: 'ProjectedEvidenceRef', schema: ProjectedEvidenceRefSchema },
  { type: 'ProjectedReference', schema: ProjectedReferenceSchema },
  { type: 'ProjectedReferenceKind', schema: ProjectedReferenceKindSchema },
  { type: 'ProjectedWorldEntityRef', schema: ProjectedWorldEntityRefSchema },
  { type: 'ProjectedWorldEventRef', schema: ProjectedWorldEventRefSchema },
  { type: 'ProjectedWorldRelationRef', schema: ProjectedWorldRelationRefSchema },
  { type: 'ProjectionRequest', schema: ProjectionRequestSchema },
  { type: 'PropertyPath', schema: PropertyPathSchema },
  { type: 'Quaternion', schema: QuaternionSchema },
  { type: 'ReplayWindow', schema: ReplayWindowSchema },
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'Shape2dDescriptor', schema: Shape2dDescriptorSchema },
  { type: 'Spatial3dDescriptor', schema: Spatial3dDescriptorSchema },
  { type: 'SpatialPrimitive', schema: SpatialPrimitiveSchema },
  { type: 'StrokeStyle2d', schema: StrokeStyle2dSchema },
  { type: 'TenantScope', schema: TenantScopeSchema },
  { type: 'TextStyle', schema: TextStyleSchema },
  { type: 'TextWeight', schema: TextWeightSchema },
  { type: 'TimelineMarkerDescriptor', schema: TimelineMarkerDescriptorSchema },
  { type: 'TimelineMarkerKind', schema: TimelineMarkerKindSchema },
  { type: 'TimelineTrackDescriptor', schema: TimelineTrackDescriptorSchema },
  { type: 'Vec3', schema: Vec3Schema },
];
