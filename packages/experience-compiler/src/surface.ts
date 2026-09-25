/**
 * The experience-compiler schema surface registry: every data type
 * published at the `contracts/experience-compiler` boundary, paired with
 * its zod schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`):
 * - every entry is exported from the package index;
 * - every entry has a declaration in `contracts/experience-compiler/index.d.ts`;
 * - every entry has a compile-time parity assertion in
 *   `contracts/experience-compiler/parity.ts`;
 * - every entry has an emitted JSON Schema file listed in
 *   `contracts/experience-compiler/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import { JsonValueSchema } from '@epoch/agent-protocol';
import {
  ColorHexSchema,
  ControlIntentSchema,
  ControlKindSchema,
  DeviceClassSchema,
  DeviceDescriptorSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  EasingKindSchema,
  ExperienceEdgeKindSchema,
  ExperienceGraphIdSchema,
  ExperienceGraphKindSchema,
  ExperienceNodeIdSchema,
  Geometry2dSchema,
  InteractionModalitySchema,
  KeyframeSchema,
  MeshBindingSchema,
  OpaqueScopeIdSchema,
  ParticipantKindSchema,
  ParticipantReferenceSchema,
  Point2dSchema,
  PoseTrackingKindSchema,
  PresentationAttributesSchema,
  ProjectedAgentRefSchema,
  ProjectedCapabilityRefSchema,
  ProjectedEvidenceRefSchema,
  ProjectedReferenceKindSchema,
  ProjectedReferenceSchema,
  ProjectedWorldEntityRefSchema,
  ProjectedWorldEventRefSchema,
  ProjectedWorldRelationRefSchema,
  QuaternionSchema,
  Sha256HexSchema,
  SpatialPrimitiveSchema,
  StrokeStyle2dSchema,
  FillStyle2dSchema,
  TenantScopeSchema,
  TextStyleSchema,
  TimelineMarkerKindSchema,
  Vec3Schema,
} from '@epoch/experience-protocol';
import {
  ExperienceCompilerDocumentKindSchema,
  ExperienceCompilerErrorCodeSchema,
  PlanStageKindSchema,
  RenderPlanProtocolVersionSchema,
} from './version';
import { CompilerErrorSchema, CompilerIssueSchema } from './errors';
import {
  PlanAnimationBindingSchema,
  PlanConstraintsSchema,
  PlanControlOpSchema,
  PlanDrawLabelOpSchema,
  PlanDrawShapeOpSchema,
  PlanNarrativeBeatSchema,
  PlanPlaceLabelOpSchema,
  PlanPlaceSpatialOpSchema,
  PlanPresenceCursorSchema,
  PlanPresenceSeatSchema,
  PlanRelationSchema,
  PlanStageSchema,
  PlanTimelineMarkerSchema,
  PlanTimelineTrackSchema,
  RenderPlanContentSchema,
  RenderPlanSchema,
  RenderPlanUsageSchema,
} from './plan';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/**
 * The complete, ordered data-type surface of experience compiler v1
 * (sorted by type name ascending — the manifest inventory order).
 */
export const EXPERIENCE_COMPILER_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ColorHex', schema: ColorHexSchema },
  { type: 'CompilerError', schema: CompilerErrorSchema },
  { type: 'CompilerIssue', schema: CompilerIssueSchema },
  { type: 'ControlIntent', schema: ControlIntentSchema },
  { type: 'ControlKind', schema: ControlKindSchema },
  { type: 'DeviceClass', schema: DeviceClassSchema },
  { type: 'DeviceDescriptor', schema: DeviceDescriptorSchema },
  { type: 'DeviceDisplayCapabilities', schema: DeviceDisplayCapabilitiesSchema },
  { type: 'DeviceSpatialCapabilities', schema: DeviceSpatialCapabilitiesSchema },
  { type: 'EasingKind', schema: EasingKindSchema },
  { type: 'ExperienceCompilerDocumentKind', schema: ExperienceCompilerDocumentKindSchema },
  { type: 'ExperienceCompilerErrorCode', schema: ExperienceCompilerErrorCodeSchema },
  { type: 'ExperienceEdgeKind', schema: ExperienceEdgeKindSchema },
  { type: 'ExperienceGraphId', schema: ExperienceGraphIdSchema },
  { type: 'ExperienceGraphKind', schema: ExperienceGraphKindSchema },
  { type: 'ExperienceNodeId', schema: ExperienceNodeIdSchema },
  { type: 'FillStyle2d', schema: FillStyle2dSchema },
  { type: 'Geometry2d', schema: Geometry2dSchema },
  { type: 'InteractionModality', schema: InteractionModalitySchema },
  { type: 'JsonValue', schema: JsonValueSchema },
  { type: 'Keyframe', schema: KeyframeSchema },
  { type: 'MeshBinding', schema: MeshBindingSchema },
  { type: 'OpaqueScopeId', schema: OpaqueScopeIdSchema },
  { type: 'ParticipantKind', schema: ParticipantKindSchema },
  { type: 'ParticipantReference', schema: ParticipantReferenceSchema },
  { type: 'PlanAnimationBinding', schema: PlanAnimationBindingSchema },
  { type: 'PlanConstraints', schema: PlanConstraintsSchema },
  { type: 'PlanControlOp', schema: PlanControlOpSchema },
  { type: 'PlanDrawLabelOp', schema: PlanDrawLabelOpSchema },
  { type: 'PlanDrawShapeOp', schema: PlanDrawShapeOpSchema },
  { type: 'PlanNarrativeBeat', schema: PlanNarrativeBeatSchema },
  { type: 'PlanPlaceLabelOp', schema: PlanPlaceLabelOpSchema },
  { type: 'PlanPlaceSpatialOp', schema: PlanPlaceSpatialOpSchema },
  { type: 'PlanPresenceCursor', schema: PlanPresenceCursorSchema },
  { type: 'PlanPresenceSeat', schema: PlanPresenceSeatSchema },
  { type: 'PlanRelation', schema: PlanRelationSchema },
  { type: 'PlanStage', schema: PlanStageSchema },
  { type: 'PlanStageKind', schema: PlanStageKindSchema },
  { type: 'PlanTimelineMarker', schema: PlanTimelineMarkerSchema },
  { type: 'PlanTimelineTrack', schema: PlanTimelineTrackSchema },
  { type: 'Point2d', schema: Point2dSchema },
  { type: 'PoseTrackingKind', schema: PoseTrackingKindSchema },
  { type: 'PresentationAttributes', schema: PresentationAttributesSchema },
  { type: 'ProjectedAgentRef', schema: ProjectedAgentRefSchema },
  { type: 'ProjectedCapabilityRef', schema: ProjectedCapabilityRefSchema },
  { type: 'ProjectedEvidenceRef', schema: ProjectedEvidenceRefSchema },
  { type: 'ProjectedReference', schema: ProjectedReferenceSchema },
  { type: 'ProjectedReferenceKind', schema: ProjectedReferenceKindSchema },
  { type: 'ProjectedWorldEntityRef', schema: ProjectedWorldEntityRefSchema },
  { type: 'ProjectedWorldEventRef', schema: ProjectedWorldEventRefSchema },
  { type: 'ProjectedWorldRelationRef', schema: ProjectedWorldRelationRefSchema },
  { type: 'Quaternion', schema: QuaternionSchema },
  { type: 'RenderPlan', schema: RenderPlanSchema },
  { type: 'RenderPlanContent', schema: RenderPlanContentSchema },
  { type: 'RenderPlanProtocolVersion', schema: RenderPlanProtocolVersionSchema },
  { type: 'RenderPlanUsage', schema: RenderPlanUsageSchema },
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'SpatialPrimitive', schema: SpatialPrimitiveSchema },
  { type: 'StrokeStyle2d', schema: StrokeStyle2dSchema },
  { type: 'TenantScope', schema: TenantScopeSchema },
  { type: 'TextStyle', schema: TextStyleSchema },
  { type: 'TimelineMarkerKind', schema: TimelineMarkerKindSchema },
  { type: 'Vec3', schema: Vec3Schema },
];
