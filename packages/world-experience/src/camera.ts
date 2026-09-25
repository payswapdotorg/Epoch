/**
 * Camera/follow semantics of the interactive world view — TYPED DATA with
 * explicit transitions, never an engine camera and never a second world
 * state.
 *
 * The camera record is pure presentation state: orbit (a viewpoint orbiting
 * an optional anchor), free (an unconstrained viewpoint), or follow-agent
 * (the view rides a projected agent's activity, optionally carrying that
 * agent's cursor state — R26/R27: shared human/agent interactions).
 *
 * Transitions are themselves typed records ({@link CameraTransition}) so a
 * presenter can render the change explicitly; {@link transitionCamera} is
 * the pure transition function (a new record, never a mutation).
 */
import { z } from 'zod';
import {
  ProjectedAgentRefSchema,
  QuaternionSchema,
  Vec3Schema,
  type Vec3,
} from '@epoch/experience-protocol';
import {
  WORLD_CAMERA_MODES,
  WORLD_CAMERA_TRANSITION_KINDS,
  WorldCameraModeSchema,
} from './version';
import { malformedRecord, malformedRecordError } from './issues';
import type { WorldExperienceResult } from './errors';

/**
 * The follow-agent cursor state: where the followed agent's 2D/3D cursor
 * was last reported, at a virtual time. Pure typed data.
 */
export const FollowCursorStateSchema = z
  .strictObject({
    position2d: z
      .strictObject({
        x: z.number().finite(),
        y: z.number().finite(),
      })
      .optional(),
    position3d: Vec3Schema.optional(),
    atMs: z.number().int().nonnegative().optional(),
  })
  .superRefine((cursor, ctx) => {
    if (cursor.position2d === undefined && cursor.position3d === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a follow cursor must carry position2d or position3d',
        path: [],
      });
    }
  })
  .meta({
    id: 'FollowCursorState',
    title: 'FollowCursorState',
    description: 'The followed agent cursor state: a 2D or 3D position at a virtual time.',
  });

/** One follow-agent cursor state. */
export type FollowCursorState = z.infer<typeof FollowCursorStateSchema>;

/** The orbit camera: a viewpoint with optional anchor target and FOV. */
export const OrbitCameraSchema = z
  .strictObject({
    mode: z.literal('orbit'),
    position: Vec3Schema,
    orientation: QuaternionSchema.optional(),
    target: Vec3Schema.optional(),
    fovRadians: z.number().finite().positive().max(Math.PI).optional(),
  })
  .meta({ id: 'OrbitCamera', title: 'OrbitCamera' });

/** One orbit camera state. */
export type OrbitCamera = z.infer<typeof OrbitCameraSchema>;

/** The free camera: an unconstrained viewpoint. */
export const FreeCameraSchema = z
  .strictObject({
    mode: z.literal('free'),
    position: Vec3Schema,
    orientation: QuaternionSchema.optional(),
  })
  .meta({ id: 'FreeCamera', title: 'FreeCamera' });

/** One free camera state. */
export type FreeCamera = z.infer<typeof FreeCameraSchema>;

/**
 * The follow-agent camera: the view rides a projected agent (opaque,
 * exact-revision) with an optional follow distance and cursor state.
 */
export const FollowAgentCameraSchema = z
  .strictObject({
    mode: z.literal('follow-agent'),
    agentRef: ProjectedAgentRefSchema,
    followDistance: z.number().finite().positive().optional(),
    cursor: FollowCursorStateSchema.optional(),
  })
  .meta({ id: 'FollowAgentCamera', title: 'FollowAgentCamera' });

/** One follow-agent camera state. */
export type FollowAgentCamera = z.infer<typeof FollowAgentCameraSchema>;

/** The camera-state union (discriminated on `mode`). */
export const CameraStateSchema = z
  .discriminatedUnion('mode', [FollowAgentCameraSchema, FreeCameraSchema, OrbitCameraSchema])
  .meta({
    id: 'CameraState',
    title: 'CameraState',
    description:
      'The camera state of a world scene as typed data: orbit, free, or follow-agent (agent plus cursor state).',
  });

/** One camera state. */
export type CameraState = z.infer<typeof CameraStateSchema>;

/**
 * One explicit camera transition: which modes changed, when (virtual
 * time), how (cut or smooth), and for how long (smooth only). Transitions
 * are typed records so presenters render them explicitly.
 */
export const CameraTransitionSchema = z
  .strictObject({
    transitionKind: z.enum(WORLD_CAMERA_TRANSITION_KINDS),
    fromMode: WorldCameraModeSchema,
    toMode: WorldCameraModeSchema,
    atMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive().optional(),
  })
  .superRefine((transition, ctx) => {
    if (transition.transitionKind === 'smooth' && transition.durationMs === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a smooth camera transition requires durationMs',
        path: ['durationMs'],
      });
    }
    if (transition.transitionKind === 'cut' && transition.durationMs !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a cut camera transition cannot carry durationMs',
        path: ['durationMs'],
      });
    }
  })
  .meta({
    id: 'CameraTransition',
    title: 'CameraTransition',
    description:
      'One explicit camera transition: kind (cut/smooth), from/to modes, virtual time, optional duration.',
  });

/** One camera transition. */
export type CameraTransition = z.infer<typeof CameraTransitionSchema>;

/** The camera modes (sorted closed vocabulary, re-exported for consumers). */
export const WORLD_CAMERA_MODE_LIST = WORLD_CAMERA_MODES;

/**
 * Input of the pure camera transition function: the target state plus the
 * explicit transition parameters.
 */
export interface CameraTransitionInput {
  readonly target: CameraState;
  readonly transitionKind: 'cut' | 'smooth';
  readonly atMs: number;
  readonly durationMs?: number;
}

/**
 * The pure camera transition: returns the next camera state and the typed
 * transition record (never mutates the current state). Schema-invalid
 * targets yield a typed `malformed-record` error.
 */
export function transitionCamera(
  current: CameraState,
  input: CameraTransitionInput,
): WorldExperienceResult<{ readonly camera: CameraState; readonly transition: CameraTransition }> {
  const target = CameraStateSchema.safeParse(input.target);
  if (!target.success) {
    return { ok: false, error: malformedRecordError(target.error) };
  }
  const transition: CameraTransition = {
    transitionKind: input.transitionKind,
    fromMode: current.mode,
    toMode: target.data.mode,
    atMs: input.atMs,
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
  };
  const checked = CameraTransitionSchema.safeParse(transition);
  if (!checked.success) {
    return { ok: false, error: malformedRecordError(checked.error) };
  }
  return { ok: true, value: { camera: target.data, transition: checked.data } };
}

/**
 * Update the cursor state of a follow-agent camera (a new record; other
 * modes yield a typed malformed-record error — cursors belong to
 * follow-agent semantics only).
 */
export function updateFollowCursor(
  camera: CameraState,
  cursor: FollowCursorState,
): WorldExperienceResult<CameraState> {
  const parsed = FollowCursorStateSchema.safeParse(cursor);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  if (camera.mode !== 'follow-agent') {
    return {
      ok: false,
      error: malformedRecord([
        {
          path: 'mode',
          message: `cursor state is only valid on a follow-agent camera (encountered "${camera.mode}")`,
        },
      ]),
    };
  }
  return { ok: true, value: { ...camera, cursor: parsed.data } };
}

/** The typed zoom payload: a strictly positive multiplicative factor. */
export const CameraZoomSchema = z
  .strictObject({
    factor: z.number().finite().positive(),
  })
  .meta({
    id: 'CameraZoom',
    title: 'CameraZoom',
    description: 'A camera zoom step: a strictly positive multiplicative factor.',
  });

/** One camera zoom payload. */
export type CameraZoom = z.infer<typeof CameraZoomSchema>;

/**
 * Apply a zoom step to a camera (pure): an orbit camera moves its position
 * toward/away from its anchor by the factor; a follow-agent camera scales
 * its follow distance; a free camera is positioned directly and is
 * unchanged. Follow-agent cursor positions are the AGENT's state and are
 * never rescaled by the viewer's zoom (authority discipline).
 */
export function zoomCamera(camera: CameraState, zoom: CameraZoom): CameraState {
  switch (camera.mode) {
    case 'orbit': {
      if (camera.target === undefined) {
        return camera;
      }
      const scaledPosition: Vec3 = [
        camera.target[0] + (camera.position[0] - camera.target[0]) * zoom.factor,
        camera.target[1] + (camera.position[1] - camera.target[1]) * zoom.factor,
        camera.target[2] + (camera.position[2] - camera.target[2]) * zoom.factor,
      ];
      return { ...camera, position: scaledPosition };
    }
    case 'free':
      return camera;
    case 'follow-agent': {
      if (camera.followDistance === undefined) {
        return camera;
      }
      const next: FollowAgentCamera = {
        ...camera,
        followDistance: camera.followDistance * zoom.factor,
      };
      return next;
    }
  }
}
