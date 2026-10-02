/**
 * The renderer-runtime schema surface registry: every data type published
 * at the `contracts/renderers` boundary, paired with its zod schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`):
 * - every entry is exported from the package index;
 * - every entry has a declaration in `contracts/renderers/index.d.ts`;
 * - every entry has a compile-time parity assertion in
 *   `contracts/renderers/parity.ts`;
 * - every entry has an emitted JSON Schema file listed in
 *   `contracts/renderers/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import { JsonValueSchema } from '@epoch/agent-protocol';
import {
  ControlIntentSchema,
  DeviceClassSchema,
  DeviceDescriptorSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  ExperienceGraphKindSchema,
  ExperienceIssueSchema,
  ExperienceProtocolErrorSchema,
  InteractionModalitySchema,
  OpaqueScopeIdSchema,
  PoseTrackingKindSchema,
  ProjectedAgentRefSchema,
  QuaternionSchema,
  ReplayWindowSchema,
  Sha256HexSchema,
  TenantScopeSchema,
  Vec3Schema,
} from '@epoch/experience-protocol';
import {
  RendererAssetKindSchema,
  RendererAssetTrustStateSchema,
  RendererBindingStateSchema,
  RendererConformanceCheckKindSchema,
  RendererDegradationKindSchema,
  RendererErrorCodeSchema,
  RendererFabricProtocolVersionSchema,
  RendererHealthStateSchema,
  RendererInputKindSchema,
  RendererIntentOutcomeSchema,
  RendererInvocationKindSchema,
  RendererProtocolVersionSchema,
  RendererReceiptKindSchema,
  RendererSessionStateSchema,
} from './version';
import {
  PortableViewStateFieldSchema,
  RendererFailureCodeSchema,
} from './version';
import {
  AssetBindingIdSchema,
  FabricSessionIdSchema,
  InputIdSchema,
  InputKeySchema,
  PointerPositionSchema,
  SemanticLayerIdSchema,
  SwitchIdSchema,
  WorldEntityIdMirrorSchema,
  WorldSceneIdMirrorSchema,
} from './fabric-primitives';
import {
  DeviceSessionIdSchema,
  InvocationIdSchema,
  RendererIdSchema,
  RendererSessionIdSchema,
  VirtualTimeMsSchema,
} from './primitives';
import {
  RendererBudgetsSchema,
  RendererDescriptorSchema,
  RendererOutputCapabilitiesSchema,
} from './descriptor';
import { DeviceSessionSnapshotSchema } from './snapshot';
import { EffectiveLimitsSchema, RendererBindingContentSchema, RendererBindingSchema } from './binding';
import { InvocationEnvelopeSchema } from './invocation';
import { RendererReceiptContentSchema, RendererReceiptSchema } from './receipt';
import { RendererIssueSchema, RendererRuntimeErrorSchema } from './errors';
import { RendererCapabilitySetSchema } from './capabilities';
import {
  PortableCameraStateSchema,
  PortableFollowAgentCameraSchema,
  PortableFollowCursorStateSchema,
  PortableFreeCameraSchema,
  PortableOrbitCameraSchema,
  PortableTimelinePositionSchema,
  PortableViewStateSchema,
  SemanticLayerVisibilitySchema,
} from './portable-state';
import { RendererHealthSchema } from './health';
import { RendererFailureSchema, RendererFailureTriggerSchema } from './failure';
import { WorldProjectionRefSchema } from './world-projection';
import { RendererSessionContentSchema, RendererSessionSchema } from './session';
import {
  RendererSessionSnapshotContentSchema,
  RendererSessionSnapshotSchema,
} from './fabric-snapshot';
import {
  RendererSwitchReceiptContentSchema,
  RendererSwitchReceiptSchema,
  RendererSwitchRequestSchema,
} from './switch';
import { RendererFrameEnvelopeSchema } from './frame';
import {
  RendererInputEnvelopeSchema,
  RendererIntentReceiptContentSchema,
  RendererIntentReceiptSchema,
} from './input';
import { RendererAssetBindingContentSchema, RendererAssetBindingSchema } from './asset-binding';
import {
  RendererConformanceCheckSchema,
  RendererConformanceResultContentSchema,
  RendererConformanceResultSchema,
} from './conformance';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/**
 * The complete, ordered data-type surface of the renderer contract (sorted
 * by type name ascending — the manifest inventory order). W013 types are
 * unchanged; the W056 fabric types were added additively.
 */
export const RENDERER_RUNTIME_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AssetBindingId', schema: AssetBindingIdSchema },
  { type: 'ControlIntent', schema: ControlIntentSchema },
  { type: 'DeviceClass', schema: DeviceClassSchema },
  { type: 'DeviceDescriptor', schema: DeviceDescriptorSchema },
  { type: 'DeviceDisplayCapabilities', schema: DeviceDisplayCapabilitiesSchema },
  { type: 'DeviceSessionId', schema: DeviceSessionIdSchema },
  { type: 'DeviceSessionSnapshot', schema: DeviceSessionSnapshotSchema },
  { type: 'DeviceSpatialCapabilities', schema: DeviceSpatialCapabilitiesSchema },
  { type: 'EffectiveLimits', schema: EffectiveLimitsSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'ExperienceGraphKind', schema: ExperienceGraphKindSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011) —
  // carried verbatim as the typed cause of wrapped graph-admission failures.
  { type: 'ExperienceIssue', schema: ExperienceIssueSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011) —
  // carried verbatim as the typed cause of wrapped graph-admission failures.
  { type: 'ExperienceProtocolError', schema: ExperienceProtocolErrorSchema },
  { type: 'FabricSessionId', schema: FabricSessionIdSchema },
  { type: 'InputId', schema: InputIdSchema },
  { type: 'InputKey', schema: InputKeySchema },
  { type: 'InteractionModality', schema: InteractionModalitySchema },
  // Mirrored shared primitive (canonical home: contracts/agent, W003) —
  // redeclared self-contained in contracts/renderers/index.d.ts, exactly
  // as contracts/experience mirrors JsonValue.
  { type: 'InvocationEnvelope', schema: InvocationEnvelopeSchema },
  { type: 'InvocationId', schema: InvocationIdSchema },
  { type: 'JsonValue', schema: JsonValueSchema },
  { type: 'OpaqueScopeId', schema: OpaqueScopeIdSchema },
  { type: 'PointerPosition', schema: PointerPositionSchema },
  { type: 'PortableCameraState', schema: PortableCameraStateSchema },
  { type: 'PortableFollowAgentCamera', schema: PortableFollowAgentCameraSchema },
  { type: 'PortableFollowCursorState', schema: PortableFollowCursorStateSchema },
  { type: 'PortableFreeCamera', schema: PortableFreeCameraSchema },
  { type: 'PortableOrbitCamera', schema: PortableOrbitCameraSchema },
  { type: 'PortableTimelinePosition', schema: PortableTimelinePositionSchema },
  { type: 'PortableViewState', schema: PortableViewStateSchema },
  { type: 'PortableViewStateField', schema: PortableViewStateFieldSchema },
  { type: 'PoseTrackingKind', schema: PoseTrackingKindSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'ProjectedAgentRef', schema: ProjectedAgentRefSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'Quaternion', schema: QuaternionSchema },
  { type: 'RendererAssetBinding', schema: RendererAssetBindingSchema },
  { type: 'RendererAssetBindingContent', schema: RendererAssetBindingContentSchema },
  { type: 'RendererAssetKind', schema: RendererAssetKindSchema },
  { type: 'RendererAssetTrustState', schema: RendererAssetTrustStateSchema },
  { type: 'RendererBinding', schema: RendererBindingSchema },
  { type: 'RendererBindingContent', schema: RendererBindingContentSchema },
  { type: 'RendererBindingState', schema: RendererBindingStateSchema },
  { type: 'RendererBudgets', schema: RendererBudgetsSchema },
  { type: 'RendererCapabilitySet', schema: RendererCapabilitySetSchema },
  { type: 'RendererConformanceCheck', schema: RendererConformanceCheckSchema },
  { type: 'RendererConformanceCheckKind', schema: RendererConformanceCheckKindSchema },
  { type: 'RendererConformanceResult', schema: RendererConformanceResultSchema },
  { type: 'RendererConformanceResultContent', schema: RendererConformanceResultContentSchema },
  { type: 'RendererDegradationKind', schema: RendererDegradationKindSchema },
  { type: 'RendererDescriptor', schema: RendererDescriptorSchema },
  { type: 'RendererErrorCode', schema: RendererErrorCodeSchema },
  { type: 'RendererFabricProtocolVersion', schema: RendererFabricProtocolVersionSchema },
  { type: 'RendererFailure', schema: RendererFailureSchema },
  { type: 'RendererFailureCode', schema: RendererFailureCodeSchema },
  { type: 'RendererFailureTrigger', schema: RendererFailureTriggerSchema },
  { type: 'RendererFrameEnvelope', schema: RendererFrameEnvelopeSchema },
  { type: 'RendererHealth', schema: RendererHealthSchema },
  { type: 'RendererHealthState', schema: RendererHealthStateSchema },
  { type: 'RendererId', schema: RendererIdSchema },
  { type: 'RendererInputEnvelope', schema: RendererInputEnvelopeSchema },
  { type: 'RendererInputKind', schema: RendererInputKindSchema },
  { type: 'RendererIntentOutcome', schema: RendererIntentOutcomeSchema },
  { type: 'RendererIntentReceipt', schema: RendererIntentReceiptSchema },
  { type: 'RendererIntentReceiptContent', schema: RendererIntentReceiptContentSchema },
  { type: 'RendererInvocationKind', schema: RendererInvocationKindSchema },
  { type: 'RendererIssue', schema: RendererIssueSchema },
  { type: 'RendererOutputCapabilities', schema: RendererOutputCapabilitiesSchema },
  { type: 'RendererProtocolVersion', schema: RendererProtocolVersionSchema },
  { type: 'RendererReceipt', schema: RendererReceiptSchema },
  { type: 'RendererReceiptContent', schema: RendererReceiptContentSchema },
  { type: 'RendererReceiptKind', schema: RendererReceiptKindSchema },
  { type: 'RendererRuntimeError', schema: RendererRuntimeErrorSchema },
  { type: 'RendererSession', schema: RendererSessionSchema },
  { type: 'RendererSessionContent', schema: RendererSessionContentSchema },
  { type: 'RendererSessionId', schema: RendererSessionIdSchema },
  { type: 'RendererSessionSnapshot', schema: RendererSessionSnapshotSchema },
  { type: 'RendererSessionSnapshotContent', schema: RendererSessionSnapshotContentSchema },
  { type: 'RendererSessionState', schema: RendererSessionStateSchema },
  { type: 'RendererSwitchReceipt', schema: RendererSwitchReceiptSchema },
  { type: 'RendererSwitchReceiptContent', schema: RendererSwitchReceiptContentSchema },
  { type: 'RendererSwitchRequest', schema: RendererSwitchRequestSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'ReplayWindow', schema: ReplayWindowSchema },
  { type: 'SemanticLayerId', schema: SemanticLayerIdSchema },
  { type: 'SemanticLayerVisibility', schema: SemanticLayerVisibilitySchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'SwitchId', schema: SwitchIdSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'TenantScope', schema: TenantScopeSchema },
  // Mirrored shared primitive (canonical home: contracts/experience, W011).
  { type: 'Vec3', schema: Vec3Schema },
  { type: 'VirtualTimeMs', schema: VirtualTimeMsSchema },
  // Mirrored W016 grammar (canonical home: @epoch/world-experience).
  { type: 'WorldEntityIdMirror', schema: WorldEntityIdMirrorSchema },
  { type: 'WorldProjectionRef', schema: WorldProjectionRefSchema },
  // Mirrored W016 grammar (canonical home: @epoch/world-experience).
  { type: 'WorldSceneIdMirror', schema: WorldSceneIdMirrorSchema },
];
