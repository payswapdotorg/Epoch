// Scheduling-model battery: pure integer boundary math, tick cadence,
// half-open window semantics, and no-double-emission across consecutive
// advances (the determinism core of the virtual clock).
import { describe, expect, it } from 'vitest';
import {
  advanceVirtualTime,
  frameIndexAt,
  frameStartMs,
  framesStartedInWindow,
  isTickBoundary,
  tickIndexAt,
  tickIndexForFrame,
  tickStartMs,
  type DeviceSessionRecord,
} from '../src/index';
import { SCHEDULE_30_EVERY_2, SCHEDULE_60, openSession } from './fixtures';

describe('frame schedule boundary math', () => {
  it('derives frame starts, ticks, and containing indices', () => {
    expect(frameStartMs(SCHEDULE_60, 0)).toBe(0);
    expect(frameStartMs(SCHEDULE_60, 5)).toBe(80);
    // SCHEDULE_60 has cadence 1: every frame is a tick boundary.
    expect(isTickBoundary(SCHEDULE_60, 0)).toBe(true);
    expect(isTickBoundary(SCHEDULE_60, 1)).toBe(true);
    expect(isTickBoundary(SCHEDULE_30_EVERY_2, 2)).toBe(true);
    expect(isTickBoundary(SCHEDULE_30_EVERY_2, 3)).toBe(false);
    expect(tickIndexForFrame(SCHEDULE_30_EVERY_2, 5)).toBe(2);
    expect(tickStartMs(SCHEDULE_30_EVERY_2, 1)).toBe(66);
    expect(frameIndexAt(SCHEDULE_30_EVERY_2, 100)).toBe(3);
    expect(tickIndexAt(SCHEDULE_30_EVERY_2, 100)).toBe(1);
  });

  it('framesStartedInWindow is the half-open [from, to) window, ascending', () => {
    expect(framesStartedInWindow(SCHEDULE_60, 0, 16)).toEqual([0]);
    expect(framesStartedInWindow(SCHEDULE_60, 0, 17)).toEqual([0, 1]);
    expect(framesStartedInWindow(SCHEDULE_60, 16, 32)).toEqual([1]);
    // A window that ends exactly at a boundary does not include that frame.
    expect(framesStartedInWindow(SCHEDULE_60, 0, 32)).toEqual([0, 1]);
    // A window that starts exactly at a boundary includes that frame.
    expect(framesStartedInWindow(SCHEDULE_60, 32, 48)).toEqual([2]);
    expect(framesStartedInWindow(SCHEDULE_60, 17, 31)).toEqual([]);
    expect(framesStartedInWindow(SCHEDULE_60, 48, 16)).toEqual([]);
  });
});

describe('consecutive advances never double-emit or drop boundaries', () => {
  function frameKindsAcrossSteps(
    steps: readonly number[],
  ): Array<{ kind: string; frameIndex: number; atMs: number }> {
    const emitted: Array<{ kind: string; frameIndex: number; atMs: number }> = [];
    let session: DeviceSessionRecord = openSession({ schedule: SCHEDULE_60 });
    for (let i = 0; i < steps.length; i += 1) {
      const advanced = advanceVirtualTime(session, steps[i]!);
      if (!advanced.ok) throw new Error(`fixture advance: ${advanced.error.message}`);
      for (const event of advanced.value.events) {
        if (event.kind === 'frame-started') {
          emitted.push({ kind: event.kind, frameIndex: event.frameIndex, atMs: event.atMs });
        }
      }
      if (i < steps.length - 1) {
        session = advanced.value.session;
      }
    }
    return emitted;
  }

  it('splitting an advance into arbitrary steps emits each frame exactly once', () => {
    const oneShot = frameKindsAcrossSteps([48]);
    const split = frameKindsAcrossSteps([7, 9, 16, 16]);
    expect(oneShot).toEqual(split);
    expect(oneShot).toEqual([
      { kind: 'frame-started', frameIndex: 0, atMs: 0 },
      { kind: 'frame-started', frameIndex: 1, atMs: 16 },
      { kind: 'frame-started', frameIndex: 2, atMs: 32 },
    ]);
  });

  it('tick events fire only at cadence boundaries, in frame order', () => {
    const session = openSession({ schedule: SCHEDULE_30_EVERY_2 });
    const advanced = advanceVirtualTime(session, 200);
    if (!advanced.ok) throw new Error('fixture advance');
    const tickEvents = advanced.value.events.filter((event) => event.kind === 'tick-advanced');
    // 33ms frames in [0, 200): indices 0..6 (starts 0..198); cadence 2
    // -> tick boundaries at frames 0, 2, 4, 6 -> ticks 0, 1, 2, 3.
    expect(tickEvents.map((event) => (event as { tickIndex: number }).tickIndex)).toEqual([
      0, 1, 2, 3,
    ]);
  });
});
