/**
 * The ecosystem-discovery scheduler CONTRACT (W045 pin 7).
 *
 * The scheduler is a provider-neutral, deployment-neutral CONTRACT, not a
 * dependency: any authorized external scheduler (workflow engine,
 * calendar service, platform scheduler) may invoke the same service
 * contract (`runEcosystemDiscovery` with trigger `scheduled`). No cron
 * library, no timers, no wall-clock — every instant is caller-supplied
 * and all cadence math is pure.
 *
 * Default cadence: WEEKLY (ARCD1.0 recommendation). Event-driven runs use
 * cadence `event` and are triggered by explicit events through the
 * service contract, never by the cadence tick.
 */
import type {
  DiscoverySchedule,
  DueDiscoveryRun,
  Timestamp,
} from './types';
import { DiscoveryScheduleSchema } from './schema';
import type { DiscoveryResult } from './types';
import { validationError } from './errors';
import { zodIssuesToDiscoveryIssues } from './errors';
import {
  DAY_MS,
  DEFAULT_DISCOVERY_CADENCE_DAYS,
  DISCOVERY_CADENCE_KINDS,
} from './version';
import { timestampToEpochMs, epochMsToTimestamp } from './canonical';

/** The deployment-neutral scheduler contract (the pinned interface). */
export interface EcosystemDiscoverySchedulerContract {
  /** The contract surface version this implementation honors. */
  readonly contractVersion: '1.0.0';
  /** Pure cadence predicate: is the schedule due at `now`? */
  isDue(schedule: DiscoverySchedule, now: Timestamp): boolean;
  /** The next due instant strictly after `now` (null when disabled/event). */
  nextDue(schedule: DiscoverySchedule, now: Timestamp): Timestamp | null;
}

/** Shared pure cadence math (the contract's reference semantics). */
function cadenceMs(cadence: DiscoverySchedule['cadence']): number | null {
  switch (cadence.kind) {
    case 'weekly':
      return DEFAULT_DISCOVERY_CADENCE_DAYS * DAY_MS;
    case 'interval':
      return cadence.intervalDays * DAY_MS;
    case 'event':
      return null;
  }
}

/** The pure reference implementation of the scheduler contract. */
export const REFERENCE_SCHEDULER: EcosystemDiscoverySchedulerContract = {
  contractVersion: '1.0.0',
  isDue(schedule, now) {
    if (!schedule.enabled) return false;
    const interval = cadenceMs(schedule.cadence);
    if (interval === null) return false; // event cadence: never tick-due
    if (schedule.lastRunAt === undefined) return true;
    return timestampToEpochMs(now) - timestampToEpochMs(schedule.lastRunAt) >= interval;
  },
  nextDue(schedule, now) {
    if (!schedule.enabled) return null;
    const interval = cadenceMs(schedule.cadence);
    if (interval === null) return null;
    if (schedule.lastRunAt === undefined) return now;
    const next = timestampToEpochMs(schedule.lastRunAt) + interval;
    const nextTs = epochMsToTimestamp(next);
    return nextTs > now ? nextTs : now;
  },
};

/**
 * The in-memory reference DRIVER: registers schedules (validated), ticks
 * at caller-supplied instants and returns the due runs. A production
 * deployment replaces the DRIVER, not the CONTRACT — the due runs are the
 * same payloads any authorized scheduler would hand to
 * `runEcosystemDiscovery`.
 */
export class InMemoryDiscoveryScheduler {
  private readonly schedules = new Map<string, DiscoverySchedule>();

  /** Register (or replace) one schedule. Total: typed validation. */
  register(schedule: DiscoverySchedule): DiscoveryResult<DiscoverySchedule> {
    const parsed = DiscoveryScheduleSchema.safeParse(schedule);
    if (!parsed.success) {
      return {
        ok: false,
        error: validationError(
          'invalid discovery schedule',
          zodIssuesToDiscoveryIssues(parsed.error),
        ),
      };
    }
    this.schedules.set(parsed.data.scheduleId, parsed.data);
    return { ok: true, value: parsed.data };
  }

  /** Remove one schedule. */
  unregister(scheduleId: string): boolean {
    return this.schedules.delete(scheduleId);
  }

  /** The registered schedules (canonical order). */
  list(): readonly DiscoverySchedule[] {
    return [...this.schedules.values()].sort((a, b) =>
      a.scheduleId < b.scheduleId ? -1 : 1,
    );
  }

  /** The schedules due at `now` (does not mutate state). */
  dueAt(now: Timestamp): readonly DueDiscoveryRun[] {
    return this.list()
      .filter((schedule) => REFERENCE_SCHEDULER.isDue(schedule, now))
      .map((schedule) => ({
        scheduleId: schedule.scheduleId,
        tenantId: schedule.tenantId,
        dueAt: now,
        adapterIds: [...schedule.adapterIds].sort(),
      }));
  }

  /**
   * Tick at `now`: return the due runs and advance `lastRunAt` for each
   * due schedule (the driver's only state change — the run itself is the
   * service contract's business).
   */
  tick(now: Timestamp): readonly DueDiscoveryRun[] {
    const due = this.dueAt(now);
    for (const run of due) {
      const schedule = this.schedules.get(run.scheduleId);
      if (schedule !== undefined) {
        this.schedules.set(run.scheduleId, { ...schedule, lastRunAt: now });
      }
    }
    return due;
  }
}

/** The cadence vocabulary (re-export for callers authoring schedules). */
export const DISCOVERY_CADENCE_KINDS_VOCAB = DISCOVERY_CADENCE_KINDS;
