/**
 * The world-experience schema surface registry: every data type published
 * at the `@epoch/world-experience` ownership boundary, paired with its
 * zod schema (W016 publishes its versioned contract surface inside the
 * package — the W007/W009 convention; see src/contract-emission.ts and
 * test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  CameraStateSchema,
  CameraTransitionSchema,
  CameraZoomSchema,
  FollowCursorStateSchema,
  FollowAgentCameraSchema,
  FreeCameraSchema,
  OrbitCameraSchema,
} from './camera';
import {
  AnimationInstructionSchema,
} from './animation';
import { NarrativeStatusBlockSchema } from './narrative';
import {
  SceneTimelineMarkerSchema,
  SceneTimelinePositionSchema,
  SceneTimelineSchema,
} from './timeline';
import {
  OverlayApplicationSchema,
  VisualOverlaySchema,
} from './overlay';
import { WorldInteractionIntentSchema } from './intent';
import { WorldOntologyRecordSchema } from './ontology';
import {
  WorldSceneFidelityProjectionSchema,
  FidelityReductionSchema,
} from './fidelity';
import {
  SceneControlSchema,
  SceneEntitySchema,
  WorldSceneContentSchema,
  WorldSceneSchema,
} from './scene';
import {
  WorldMountGraphEnvelopeSchema,
  WorldAdvanceFrameEnvelopeSchema,
  WorldSubmitIntentEnvelopeSchema,
} from './compile';
import { WorldRenderBudgetsSchema } from './budget';
import {
  WorldSceneIdSchema,
  WorldOverlayIdSchema,
  WorldOntologyRecordIdSchema,
  WorldEntityIdSchema,
  WorldRendererSessionIdSchema,
  WorldInvocationIdSchema,
} from './primitives';
import { WorldIntentEffectSchema } from './reducer';
import { WorldExperienceErrorSchema, WorldIssueSchema } from './errors';
import {
  WorldExperienceProtocolVersionSchema,
  WorldInteractionKindSchema,
  WorldOntologyRecordKindSchema,
  WorldFidelityLevelSchema,
  WorldCameraModeSchema,
  WorldCameraTransitionKindSchema,
  WorldOverlayKindSchema,
} from './version';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the world-experience contract v1. */
export const WORLD_EXPERIENCE_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AnimationInstruction', schema: AnimationInstructionSchema },
  { type: 'CameraState', schema: CameraStateSchema },
  { type: 'CameraTransition', schema: CameraTransitionSchema },
  { type: 'CameraZoom', schema: CameraZoomSchema },
  { type: 'FidelityReduction', schema: FidelityReductionSchema },
  { type: 'FollowAgentCamera', schema: FollowAgentCameraSchema },
  { type: 'FollowCursorState', schema: FollowCursorStateSchema },
  { type: 'FreeCamera', schema: FreeCameraSchema },
  { type: 'NarrativeStatusBlock', schema: NarrativeStatusBlockSchema },
  { type: 'OrbitCamera', schema: OrbitCameraSchema },
  { type: 'OverlayApplication', schema: OverlayApplicationSchema },
  { type: 'SceneControl', schema: SceneControlSchema },
  { type: 'SceneEntity', schema: SceneEntitySchema },
  { type: 'SceneTimeline', schema: SceneTimelineSchema },
  { type: 'SceneTimelineMarker', schema: SceneTimelineMarkerSchema },
  { type: 'SceneTimelinePosition', schema: SceneTimelinePositionSchema },
  { type: 'VisualOverlay', schema: VisualOverlaySchema },
  { type: 'WorldAdvanceFrameEnvelope', schema: WorldAdvanceFrameEnvelopeSchema },
  { type: 'WorldCameraMode', schema: WorldCameraModeSchema },
  { type: 'WorldCameraTransitionKind', schema: WorldCameraTransitionKindSchema },
  { type: 'WorldEntityId', schema: WorldEntityIdSchema },
  { type: 'WorldExperienceError', schema: WorldExperienceErrorSchema },
  { type: 'WorldExperienceProtocolVersion', schema: WorldExperienceProtocolVersionSchema },
  { type: 'WorldFidelityLevel', schema: WorldFidelityLevelSchema },
  { type: 'WorldIntentEffect', schema: WorldIntentEffectSchema },
  { type: 'WorldInteractionIntent', schema: WorldInteractionIntentSchema },
  { type: 'WorldInteractionKind', schema: WorldInteractionKindSchema },
  { type: 'WorldInvocationId', schema: WorldInvocationIdSchema },
  { type: 'WorldIssue', schema: WorldIssueSchema },
  { type: 'WorldMountGraphEnvelope', schema: WorldMountGraphEnvelopeSchema },
  { type: 'WorldOntologyRecord', schema: WorldOntologyRecordSchema },
  { type: 'WorldOntologyRecordId', schema: WorldOntologyRecordIdSchema },
  { type: 'WorldOntologyRecordKind', schema: WorldOntologyRecordKindSchema },
  { type: 'WorldOverlayId', schema: WorldOverlayIdSchema },
  { type: 'WorldOverlayKind', schema: WorldOverlayKindSchema },
  { type: 'WorldRenderBudgets', schema: WorldRenderBudgetsSchema },
  { type: 'WorldRendererSessionId', schema: WorldRendererSessionIdSchema },
  { type: 'WorldScene', schema: WorldSceneSchema },
  { type: 'WorldSceneContent', schema: WorldSceneContentSchema },
  { type: 'WorldSceneFidelityProjection', schema: WorldSceneFidelityProjectionSchema },
  { type: 'WorldSceneId', schema: WorldSceneIdSchema },
  { type: 'WorldSubmitIntentEnvelope', schema: WorldSubmitIntentEnvelopeSchema },
];
