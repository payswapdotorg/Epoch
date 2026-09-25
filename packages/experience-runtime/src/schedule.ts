/**
 * The deterministic virtual-time frame/tick scheduling model.
 *
 * A {@link FrameSchedule} is pure typed data: an integer frame duration and
 * an integer tick cadence (frames per tick). Frame `i` occupies the
 * half-open virtual interval `[i * frameDurationMs, (i + 1) *
 * frameDurationMs)`; a tick fires at the start of every frame whose index
 * is a multiple of `tickCadence`. All derivation helpers below are pure
 * integer functions — no wall clock, no timers, no floating-point boundary
 * math — so two sessions fed identical schedules produce identical event
 * traces (the virtual-time determinism pin of W013).
 *
 * Window semantics: a frame "starts in" the half-open window
 * `[fromMs, toMs)` when its start time lies in that window. Consecutive
 * advances therefore neither double-emit nor drop a boundary.
 */
import { z } from 'zod';
import { MAX_FRAME_DURATION_MS, MAX_TICK_CADENCE } from './version';

/** Version discriminator of the frame-schedule record. */
export const FRAME_SCHEDULE_VERSION = 1 as const;

/**
 * The frame/tick schedule of a device session: integer virtual-time
 * cadences only. `frameDurationMs` is the fixed frame period;
 * `tickCadence` is the number of frames per tick (a tick boundary frame
 * has an index divisible by the cadence).
 */
export const FrameScheduleSchema = z
  .strictObject({
    scheduleVersion: z.literal(FRAME_SCHEDULE_VERSION),
    /** Fixed frame period in integer milliseconds (1..60000). */
    frameDurationMs: z.number().int().min(1).max(MAX_FRAME_DURATION_MS),
    /** Frames per tick (1..1000); frame 0 is always a tick boundary. */
    tickCadence: z.number().int().min(1).max(MAX_TICK_CADENCE),
  })
  .meta({
    id: 'FrameSchedule',
    title: 'FrameSchedule',
    description:
      'Deterministic virtual-time frame/tick schedule: integer frame duration plus integer tick cadence (frames per tick).',
  });

/** One frame schedule. */
export type FrameSchedule = z.infer<typeof FrameScheduleSchema>;

/** Start time (virtual ms) of frame `frameIndex`. */
export function frameStartMs(schedule: FrameSchedule, frameIndex: number): number {
  return frameIndex * schedule.frameDurationMs;
}

/** Start time (virtual ms) of tick `tickIndex`. */
export function tickStartMs(schedule: FrameSchedule, tickIndex: number): number {
  return tickIndex * schedule.frameDurationMs * schedule.tickCadence;
}

/** Whether `frameIndex` is a tick-boundary frame of `schedule`. */
export function isTickBoundary(schedule: FrameSchedule, frameIndex: number): boolean {
  return frameIndex % schedule.tickCadence === 0;
}

/** Tick index that covers `frameIndex`. */
export function tickIndexForFrame(schedule: FrameSchedule, frameIndex: number): number {
  return Math.floor(frameIndex / schedule.tickCadence);
}

/** Frame index whose interval contains virtual time `atMs`. */
export function frameIndexAt(schedule: FrameSchedule, atMs: number): number {
  return Math.floor(atMs / schedule.frameDurationMs);
}

/** Tick index whose interval contains virtual time `atMs`. */
export function tickIndexAt(schedule: FrameSchedule, atMs: number): number {
  return Math.floor(atMs / (schedule.frameDurationMs * schedule.tickCadence));
}

/**
 * The frame indices that START in the half-open virtual window
 * `[fromMs, toMs)`, ascending. Pure integer derivation: the first index is
 * `ceil(fromMs / D)` and the last is the greatest `i` with `i * D < toMs`.
 * An empty result is valid (no boundary in the window).
 */
export function framesStartedInWindow(
  schedule: FrameSchedule,
  fromMs: number,
  toMs: number,
): readonly number[] {
  if (toMs <= fromMs) {
    return [];
  }
  const d = schedule.frameDurationMs;
  const first = Math.ceil(fromMs / d);
  // i * d < toMs  =>  i < toMs / d  =>  i <= ceil(toMs / d) - 1
  const last = Math.ceil(toMs / d) - 1;
  const indices: number[] = [];
  for (let i = Math.max(first, 0); i <= last; i += 1) {
    indices.push(i);
  }
  return indices;
}
