// W045 pin 7: the scheduler is a CONTRACT (interface + pure cadence
// semantics) with an in-memory reference driver — deployment-neutral, no
// scheduler dependency, no cron library, weekly default cadence,
// event-driven runs through the service contract.
import { describe, expect, it } from 'vitest';
import {
  InMemoryDiscoveryScheduler,
  REFERENCE_SCHEDULER,
} from '../src/scheduler';
import type { DiscoverySchedule } from '../src/types';
import { AT_1, AT_2, AT_3, AT_WEEK_LATER, AT_WEEK_AND_A_DAY, TENANT_A } from './fixtures';

function weeklySchedule(): DiscoverySchedule {
  return {
    scheduleId: 'sched-weekly',
    tenantId: TENANT_A,
    cadence: { kind: 'weekly' },
    adapterIds: ['fixture-catalog'],
    enabled: true,
  };
}

describe('the scheduler contract (pin 7)', () => {
  it('the reference implementation honors the contract version', () => {
    expect(REFERENCE_SCHEDULER.contractVersion).toBe('1.0.0');
  });

  it('a never-run schedule is due immediately', () => {
    expect(REFERENCE_SCHEDULER.isDue(weeklySchedule(), AT_1)).toBe(true);
  });

  it('weekly cadence: due exactly after 7 days, not before', () => {
    const schedule: DiscoverySchedule = { ...weeklySchedule(), lastRunAt: AT_1 };
    expect(REFERENCE_SCHEDULER.isDue(schedule, AT_2)).toBe(false); // +1 day
    expect(REFERENCE_SCHEDULER.isDue(schedule, AT_3)).toBe(false); // +2 days
    expect(REFERENCE_SCHEDULER.isDue(schedule, AT_WEEK_LATER)).toBe(true); // +7 days
    expect(REFERENCE_SCHEDULER.isDue(schedule, AT_WEEK_AND_A_DAY)).toBe(true); // +8 days
  });

  it('interval cadence and disabled schedules', () => {
    const interval: DiscoverySchedule = {
      ...weeklySchedule(),
      scheduleId: 'sched-interval',
      cadence: { kind: 'interval', intervalDays: 2 },
      lastRunAt: AT_1,
    };
    expect(REFERENCE_SCHEDULER.isDue(interval, AT_2)).toBe(false);
    expect(REFERENCE_SCHEDULER.isDue(interval, AT_3)).toBe(true);
    expect(REFERENCE_SCHEDULER.isDue({ ...interval, enabled: false }, AT_WEEK_LATER)).toBe(false);
  });

  it('event cadence is never tick-due (events go through the service contract)', () => {
    const event: DiscoverySchedule = {
      ...weeklySchedule(),
      scheduleId: 'sched-event',
      cadence: { kind: 'event' },
    };
    expect(REFERENCE_SCHEDULER.isDue(event, AT_1)).toBe(false);
    expect(REFERENCE_SCHEDULER.nextDue(event, AT_1)).toBeNull();
  });

  it('nextDue computes the next due instant (or null when disabled)', () => {
    const schedule: DiscoverySchedule = { ...weeklySchedule(), lastRunAt: AT_1 };
    expect(REFERENCE_SCHEDULER.nextDue(schedule, AT_1)).toBe('2026-10-12T09:00:00.000Z');
    expect(REFERENCE_SCHEDULER.nextDue(schedule, AT_WEEK_LATER)).toBe(AT_WEEK_LATER);
    expect(REFERENCE_SCHEDULER.nextDue({ ...schedule, enabled: false }, AT_1)).toBeNull();
  });

  it('the pure contract functions never mutate the schedule', () => {
    const schedule = weeklySchedule();
    REFERENCE_SCHEDULER.isDue(schedule, AT_1);
    REFERENCE_SCHEDULER.nextDue(schedule, AT_1);
    expect(schedule.lastRunAt).toBeUndefined();
  });
});

describe('the in-memory reference driver', () => {
  it('registers, ticks and advances lastRunAt deterministically', () => {
    const driver = new InMemoryDiscoveryScheduler();
    const registered = driver.register(weeklySchedule());
    expect(registered.ok).toBe(true);

    // First tick: due (never run).
    const dueFirst = driver.tick(AT_1);
    expect(dueFirst).toHaveLength(1);
    expect(dueFirst[0]).toMatchObject({
      scheduleId: 'sched-weekly',
      tenantId: TENANT_A,
      adapterIds: ['fixture-catalog'],
    });

    // Immediately after: not due.
    expect(driver.tick(AT_2)).toHaveLength(0);
    // A week later: due again.
    const dueAgain = driver.tick(AT_WEEK_LATER);
    expect(dueAgain).toHaveLength(1);
    expect(driver.list()[0]!.lastRunAt).toBe(AT_WEEK_LATER);
  });

  it('validates registered schedules (typed validation)', () => {
    const driver = new InMemoryDiscoveryScheduler();
    const invalid = driver.register({
      scheduleId: 'sched-bad',
      tenantId: 'not-a-tenant',
      cadence: { kind: 'weekly' },
      adapterIds: [],
      enabled: true,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.code).toBe('validation');
    // Interval cadence bounds are enforced.
    const badInterval = driver.register({
      scheduleId: 'sched-bad-interval',
      tenantId: TENANT_A,
      cadence: { kind: 'interval', intervalDays: 0 },
      adapterIds: [],
      enabled: true,
    });
    expect(badInterval.ok).toBe(false);
  });

  it('unregister and list are canonical', () => {
    const driver = new InMemoryDiscoveryScheduler();
    driver.register(weeklySchedule());
    driver.register({
      scheduleId: 'sched-a',
      tenantId: TENANT_A,
      cadence: { kind: 'event' },
      adapterIds: [],
      enabled: true,
    });
    expect(driver.list().map((schedule) => schedule.scheduleId)).toEqual([
      'sched-a',
      'sched-weekly',
    ]);
    expect(driver.unregister('sched-a')).toBe(true);
    expect(driver.list()).toHaveLength(1);
  });
});
