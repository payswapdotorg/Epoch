/**
 * The WALL-CLOCK host surface of the interactive world (W057).
 *
 * Division of time (the TL-confirmed advisory): the Renderer Fabric core
 * stays VIRTUAL-TIME-ONLY (every fabric method takes caller-supplied
 * virtual times; zero wall-clock reads in @epoch/renderer-fabric and
 * @epoch/world-experience). THIS package — the world runtime — owns the
 * wall clock: it is the only layer that reads real time, and it DERIVES
 * the virtual times it hands the fabric from that clock. The host loop
 * therefore drives presentation (frame envelopes + presentation timeline
 * ticks + health polls) while all semantic admissions remain virtual-time
 * deterministic.
 *
 * Everything is injectable so tests drive deterministic virtual timelines:
 * a ManualHostClock + ManualFrameScheduler reproduce exact frame cadences,
 * while the system implementations use the platform (Date.now +
 * setTimeout) — the only wall-clock/timeout reads in the runtime.
 */

/** The wall-clock source of the host loop. */
export interface HostClock {
  /** Real time in integer milliseconds (monotonic in practice). */
  nowMs(): number;
}

/** The system wall clock (the ONLY wall-clock read in the runtime). */
export class SystemHostClock implements HostClock {
  nowMs(): number {
    return Date.now();
  }
}

/** A manual clock for tests and harnesses (deterministic). */
export class ManualHostClock implements HostClock {
  private currentMs: number;

  constructor(startMs: number = 0) {
    this.currentMs = startMs;
  }

  nowMs(): number {
    return this.currentMs;
  }

  /** Advance the manual clock (kept for harness determinism). */
  advanceTo(ms: number): void {
    this.currentMs = Math.max(this.currentMs, Math.trunc(ms));
  }
}

/** One scheduled host-loop callback. */
export interface HostTick {
  /** Cancel this scheduled callback (idempotent). */
  cancel(): void;
  /** Whether this callback is still scheduled. */
  readonly active: boolean;
}

/** The scheduling primitive of the host loop (injectable). */
export interface FrameScheduler {
  /**
   * Schedule one callback. Implementations MUST invoke it at most once and
   * pass no arguments (the loop reads the clock itself).
   */
  schedule(callback: () => void): HostTick;
}

/**
 * The timeout-based frame scheduler (the default). ~16ms cadence ≈ 60fps
 * presentation pacing; the actual cadence is measured from the clock, so
 * slow hosts degrade presentation frequency only (typed fidelity is a
 * renderer concern, never a semantic one).
 */
export class TimeoutFrameScheduler implements FrameScheduler {
  schedule(callback: () => void): HostTick {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      callback();
    }, 16);
    return {
      cancel: () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      get active() {
        return timer !== null;
      },
    };
  }
}

/** A manual scheduler for tests and harnesses (deterministic). */
export class ManualFrameScheduler implements FrameScheduler {
  private scheduled: { callback: () => void; cancelled: boolean }[] = [];

  schedule(callback: () => void): HostTick {
    const entry = { callback, cancelled: false };
    this.scheduled.push(entry);
    return {
      cancel: () => {
        entry.cancelled = true;
      },
      get active() {
        return !entry.cancelled;
      },
    };
  }

  /**
   * Fire every pending scheduled callback exactly once, in scheduling
   * order. Cancelled entries are dropped. Returns the number fired.
   */
  fire(): number {
    const pending = this.scheduled;
    this.scheduled = [];
    let fired = 0;
    for (const entry of pending) {
      if (entry.cancelled) continue;
      fired += 1;
      entry.callback();
    }
    return fired;
  }

  /** Whether any callback is pending. */
  get pending(): number {
    return this.scheduled.length;
  }
}

/** One host-loop tick handed to the runtime. */
export interface HostLoopTick {
  /** The wall-clock time of this tick (integer ms). */
  readonly atMs: number;
  /** Milliseconds since the previous tick (0 on the first tick). */
  readonly deltaMs: number;
  /** The tick index since start (0-based). */
  readonly index: number;
}

/** The host loop: the runtime's presentation driver. */
export class HostLoop {
  private readonly clock: HostClock;
  private readonly scheduler: FrameScheduler;
  private tick: HostTick | null = null;
  private lastAtMs: number | null = null;
  private index = 0;
  private running = false;

  constructor(clock: HostClock, scheduler: FrameScheduler) {
    this.clock = clock;
    this.scheduler = scheduler;
  }

  /** Whether the loop is running. */
  get isRunning(): boolean {
    return this.running;
  }

  /** Start the loop; the handler receives one tick per scheduled frame. */
  start(handler: (tick: HostLoopTick) => void): void {
    if (this.running) return;
    this.running = true;
    this.lastAtMs = null;
    this.index = 0;
    const step = () => {
      if (!this.running) return;
      const atMs = this.clock.nowMs();
      const tick: HostLoopTick = {
        atMs,
        deltaMs: this.lastAtMs === null ? 0 : Math.max(0, atMs - this.lastAtMs),
        index: this.index,
      };
      this.lastAtMs = atMs;
      this.index += 1;
      this.tick = this.scheduler.schedule(step);
      handler(tick);
    };
    this.tick = this.scheduler.schedule(step);
  }

  /** Stop the loop (idempotent). */
  stop(): void {
    this.running = false;
    if (this.tick !== null) {
      this.tick.cancel();
      this.tick = null;
    }
    this.lastAtMs = null;
    this.index = 0;
  }
}
