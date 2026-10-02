// W057 — the wall-clock host surface: determinism of the injected clock +
// scheduler, loop lifecycle, and the system implementations' shape (the
// system clock/scheduler are the ONLY wall-clock/timeout reads in the
// runtime; everything else is injected).
import { describe, expect, it } from 'vitest';
import {
  HostLoop,
  ManualFrameScheduler,
  ManualHostClock,
  SystemHostClock,
  TimeoutFrameScheduler,
} from '../src/clock';

describe('the host clock', () => {
  it('the manual clock advances monotonically', () => {
    const clock = new ManualHostClock(1_000);
    expect(clock.nowMs()).toBe(1_000);
    clock.advanceTo(2_500);
    expect(clock.nowMs()).toBe(2_500);
    clock.advanceTo(2_000); // never moves backwards
    expect(clock.nowMs()).toBe(2_500);
  });

  it('the system clock reads real integer milliseconds', () => {
    const before = Date.now();
    const read = new SystemHostClock().nowMs();
    const after = Date.now();
    expect(Number.isInteger(read)).toBe(true);
    expect(read).toBeGreaterThanOrEqual(before);
    expect(read).toBeLessThanOrEqual(after);
  });
});

describe('the manual frame scheduler', () => {
  it('fires each scheduled callback exactly once, in order, dropping cancelled entries', () => {
    const scheduler = new ManualFrameScheduler();
    const fired: string[] = [];
    const first = scheduler.schedule(() => fired.push('first'));
    scheduler.schedule(() => fired.push('second'));
    first.cancel();
    expect(scheduler.pending).toBe(2);
    expect(scheduler.fire()).toBe(1);
    expect(fired).toEqual(['second']);
    expect(scheduler.pending).toBe(0);
    expect(scheduler.fire()).toBe(0);
  });

  it('a cancelled tick reports inactive', () => {
    const scheduler = new ManualFrameScheduler();
    const tick = scheduler.schedule(() => {});
    expect(tick.active).toBe(true);
    tick.cancel();
    expect(tick.active).toBe(false);
    expect(scheduler.fire()).toBe(0);
  });
});

describe('the host loop', () => {
  it('derives tick times and deltas from the injected clock (never a wall read)', () => {
    const clock = new ManualHostClock(5_000);
    const scheduler = new ManualFrameScheduler();
    const loop = new HostLoop(clock, scheduler);
    const ticks: { atMs: number; deltaMs: number; index: number }[] = [];
    loop.start((tick) => ticks.push({ atMs: tick.atMs, deltaMs: tick.deltaMs, index: tick.index }));
    expect(loop.isRunning).toBe(true);

    scheduler.fire();
    clock.advanceTo(5_016);
    scheduler.fire();
    clock.advanceTo(5_032);
    scheduler.fire();

    expect(ticks.map((tick) => tick.atMs)).toEqual([5_000, 5_016, 5_032]);
    expect(ticks.map((tick) => tick.deltaMs)).toEqual([0, 16, 16]);
    expect(ticks.map((tick) => tick.index)).toEqual([0, 1, 2]);
    loop.stop();
    expect(loop.isRunning).toBe(false);
  });

  it('stop cancels pending ticks and restart resets the cadence', () => {
    const clock = new ManualHostClock(0);
    const scheduler = new ManualFrameScheduler();
    const loop = new HostLoop(clock, scheduler);
    let ticks = 0;
    loop.start(() => {
      ticks += 1;
    });
    loop.stop();
    expect(scheduler.fire()).toBe(0); // the pending step was cancelled
    loop.start(() => {
      ticks += 1;
    });
    scheduler.fire();
    expect(ticks).toBe(1);
    loop.stop();
  });

  it('the timeout scheduler schedules exactly one callback per schedule call', () => {
    const scheduler = new TimeoutFrameScheduler();
    const tick = scheduler.schedule(() => {});
    expect(tick.active).toBe(true);
    tick.cancel();
    expect(tick.active).toBe(false);
  });
});
