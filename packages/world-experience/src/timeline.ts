/**
 * Timeline/replay state of the interactive world view — typed records for
 * the timeline markers (event, phase boundary, replay cursor, branch
 * point — the W011 marker vocabulary) and the scene's timeline/replay
 * POSITION (virtual time + frame index + paused flag + optional replay
 * window, R7).
 *
 * Positions are validated against the timeline's bounds: a position
 * outside [0, endMs] (endMs = the last marker's time, or the track end) is
 * a typed `invalid-replay-position` rejection — replaying where there is
 * no timeline to replay is a contract violation, never a silent clamp.
 */
import { z } from 'zod';
import {
  ReplayWindowSchema,
  TimelineMarkerKindSchema,
  type ReplayWindow,
  type TimelineMarkerKind,
} from '@epoch/experience-protocol';
import { MAX_TIMELINE_MARKERS } from './version';
import { WorldVirtualTimeMsSchema } from './primitives';
import {
  invalidReplayPositionError,
  malformedRecordError,
} from './issues';
import type { WorldExperienceResult } from './errors';

/** Bounded marker-local identifier: lowercase kebab slug. */
const SceneMarkerIdSchema = z
  .string()
  .regex(/^mrk-[a-z0-9][a-z0-9-]{0,62}$/)
  .meta({
    id: 'SceneMarkerId',
    title: 'SceneMarkerId',
    description: 'Scene timeline-marker identifier: "mrk-" followed by a lowercase slug.',
  });

/** One scene timeline-marker identifier. */
export type SceneTimelineMarkerId = z.infer<typeof SceneMarkerIdSchema>;

/** One timeline marker of a world scene. */
export const SceneTimelineMarkerSchema = z
  .strictObject({
    markerId: SceneMarkerIdSchema,
    atMs: WorldVirtualTimeMsSchema,
    label: z.string().max(256).optional(),
    markerKind: TimelineMarkerKindSchema,
  })
  .meta({
    id: 'SceneTimelineMarker',
    title: 'SceneTimelineMarker',
    description:
      'One scene timeline marker: virtual time, optional label, and kind (event, phase boundary, replay cursor, branch point).',
  });

/** One timeline marker. */
export type SceneTimelineMarker = z.infer<typeof SceneTimelineMarkerSchema>;

/** The scene's timeline/replay position (R7). */
export const SceneTimelinePositionSchema = z
  .strictObject({
    atMs: WorldVirtualTimeMsSchema,
    frameIndex: z.number().int().nonnegative(),
    paused: z.boolean(),
    replayWindow: ReplayWindowSchema.optional(),
  })
  .meta({
    id: 'SceneTimelinePosition',
    title: 'SceneTimelinePosition',
    description:
      'The scene timeline/replay position: virtual time, frame index, paused flag, optional replay window.',
  });

/** One timeline/replay position. */
export type SceneTimelinePosition = z.infer<typeof SceneTimelinePositionSchema>;

/** The scene's timeline: markers plus the current position. */
export const SceneTimelineSchema = z
  .strictObject({
    markers: z.array(SceneTimelineMarkerSchema).max(MAX_TIMELINE_MARKERS),
    trackLabel: z.string().min(1).max(256),
    trackStartMs: WorldVirtualTimeMsSchema,
    trackEndMs: WorldVirtualTimeMsSchema,
    position: SceneTimelinePositionSchema,
  })
  .superRefine((timeline, ctx) => {
    const keys = timeline.markers.map((m) => `${m.atMs}\u0000${m.markerId}`);
    for (let i = 1; i < keys.length; i += 1) {
      if (keys[i] <= keys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message:
            'markers must be sorted by (atMs, markerId) ascending and duplicate-free (deterministic serialization)',
          path: ['markers'],
        });
        return;
      }
    }
    if (timeline.trackEndMs <= timeline.trackStartMs) {
      ctx.addIssue({
        code: 'custom',
        message: 'trackEndMs must be greater than trackStartMs',
        path: ['trackEndMs'],
      });
    }
    for (const marker of timeline.markers) {
      if (marker.atMs < timeline.trackStartMs || marker.atMs > timeline.trackEndMs) {
        ctx.addIssue({
          code: 'custom',
          message: `marker "${marker.markerId}" at ${marker.atMs}ms lies outside the track bounds [${timeline.trackStartMs}, ${timeline.trackEndMs}]ms`,
          path: ['markers'],
        });
      }
    }
  })
  .meta({
    id: 'SceneTimeline',
    title: 'SceneTimeline',
    description:
      'The scene timeline: sorted markers (event/phase/replay-cursor/branch-point), a bounded track, and the current replay position.',
  });

/** One scene timeline. */
export type SceneTimeline = z.infer<typeof SceneTimelineSchema>;

/**
 * The timeline end in virtual milliseconds: the last marker's time when
 * markers exist, else the track end (the deterministic playback bound).
 */
export function timelineEndMs(timeline: SceneTimeline): number {
  const lastMarker = timeline.markers.length > 0 ? timeline.markers[timeline.markers.length - 1] : null;
  return lastMarker !== null ? Math.min(lastMarker.atMs, timeline.trackEndMs) : timeline.trackEndMs;
}

/**
 * Validate a timeline position against a timeline's bounds: atMs within
 * [0, endMs] (the position may sit before the track start — a rewind), the
 * frame index non-negative, and the replay window structurally valid.
 * Out-of-bounds positions are typed `invalid-replay-position` rejections.
 */
export function validateTimelinePosition(
  timeline: SceneTimeline,
  position: SceneTimelinePosition,
): WorldExperienceResult<void> {
  const parsed = SceneTimelinePositionSchema.safeParse(position);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  const end = timelineEndMs(timeline);
  if (parsed.data.atMs > end) {
    return {
      ok: false,
      error: invalidReplayPositionError(
        `the replay position ${parsed.data.atMs}ms exceeds the timeline end (${end}ms)`,
        { boundMs: end, encounteredMs: parsed.data.atMs },
      ),
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Pure position seek: returns the next position at the requested virtual
 * time (frame index advances by one — the presenter's next frame). Seeks
 * beyond the timeline end are typed `invalid-replay-position` rejections.
 */
export function seekTimelinePosition(
  timeline: SceneTimeline,
  toMs: number,
): WorldExperienceResult<SceneTimelinePosition> {
  if (!Number.isInteger(toMs) || toMs < 0) {
    return {
      ok: false,
      error: invalidReplayPositionError(
        `the replay position must be a non-negative integer millisecond value (encountered ${toMs})`,
        { encounteredMs: toMs },
      ),
    };
  }
  const end = timelineEndMs(timeline);
  if (toMs > end) {
    return {
      ok: false,
      error: invalidReplayPositionError(
        `the seek target ${toMs}ms exceeds the timeline end (${end}ms)`,
        { boundMs: end, encounteredMs: toMs },
      ),
    };
  }
  return {
    ok: true,
    value: {
      atMs: toMs,
      frameIndex: timeline.position.frameIndex + 1,
      paused: timeline.position.paused,
      ...(timeline.position.replayWindow !== undefined
        ? { replayWindow: timeline.position.replayWindow }
        : {}),
    },
  };
}

/** Pure pause: the next position with `paused` set. */
export function pauseTimeline(timeline: SceneTimeline): SceneTimelinePosition {
  return { ...timeline.position, paused: true };
}

/** Pure resume: the next position with `paused` cleared. */
export function resumeTimeline(timeline: SceneTimeline): SceneTimelinePosition {
  return { ...timeline.position, paused: false };
}

/** Timeline usage accounting (pure). */
export interface TimelineUsage {
  readonly markerCount: number;
  readonly branchPointCount: number;
  readonly replayCursorCount: number;
  readonly paused: boolean;
  readonly positionAtMs: number;
}

/** Compute the timeline usage record of a scene timeline. */
export function computeTimelineUsage(timeline: SceneTimeline): TimelineUsage {
  let branchPointCount = 0;
  let replayCursorCount = 0;
  for (const marker of timeline.markers) {
    if (marker.markerKind === 'branch-point') {
      branchPointCount += 1;
    }
    if (marker.markerKind === 'replay-cursor') {
      replayCursorCount += 1;
    }
  }
  return {
    markerCount: timeline.markers.length,
    branchPointCount,
    replayCursorCount,
    paused: timeline.position.paused,
    positionAtMs: timeline.position.atMs,
  };
}

/** Exported for the schema surface registry (type-level only). */
export type SceneReplayWindow = ReplayWindow;
export type SceneMarkerKind = TimelineMarkerKind;
