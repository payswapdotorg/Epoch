// The scheduler invocation (deployment-neutral, W045 scheduling note):
// the in-memory driver's due payloads are handed to the SAME
// ecosystem-scan service contract any authorized external scheduler
// would invoke; per-schedule authorization is fail-closed; the weekly
// default cadence advances.
import { describe, expect, it } from 'vitest';
import { StaticCatalogSourceAdapter } from '@epoch/capability-discovery';
import type { DiscoveryInput } from '@epoch/capability-discovery';
import { buildService } from './fixtures';
import { ALLOW, PRINCIPAL_LEAD, PRINCIPAL_SCHEDULER, TENANT_ALPHA } from './fixtures';

const ADAPTER = new StaticCatalogSourceAdapter({
  adapterId: 'fixture-catalog',
  description: 'static fixture catalog',
  catalog: [
    {
      artifactId: 'analysis-artifact',
      contentDigest: 'f'.repeat(64),
      summary: 'Claims stress analysis',
      claimedCapabilities: [
        {
          operation: { id: 'engineering.stress-analysis', versionConstraint: '*' },
          inputKinds: ['geometry'],
          outputKinds: ['numeric'],
          claimBasis: 'declared',
        },
      ],
      environmentNotes: [],
    },
  ],
});

function gapSeedingInput(): DiscoveryInput {
  return {
    schemaVersion: 1,
    tenantId: TENANT_ALPHA,
    task: {
      summary: 'Assess a structure',
      lifecycleStage: 'understand',
      domainRefs: ['construction'],
      objectives: ['assessment'],
    },
    worldRefs: [],
    evidenceSignals: [],
    constraintSignals: [],
    taskSignals: [
      {
        signalId: 's-analysis',
        kind: 'operation',
        summary: 'Structural analysis',
        subjectRefs: [],
        evidenceRefs: [],
        constraintRefs: [],
        operationRef: { id: 'engineering.stress-analysis', versionConstraint: '*' },
        representationHints: ['geometry'],
        outputHints: ['numeric'],
      },
    ],
    packContributions: [],
  };
}

describe('the deployment-neutral scheduler invocation', () => {
  it('registers a weekly schedule and runs the due scan through the service contract', () => {
    const service = buildService();
    // Seed an UNSATISFIED gap.
    const seeded = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: gapSeedingInput(),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!seeded.ok) throw new Error(seeded.error.message);

    const registered = service.registerSchedule(PRINCIPAL_LEAD, ALLOW, {
      scheduleId: 'sched-weekly-alpha',
      tenantId: TENANT_ALPHA,
      cadence: { kind: 'weekly' },
      adapterIds: ['fixture-catalog'],
      enabled: true,
    });
    expect(registered.ok).toBe(true);

    // First tick (never ran): due immediately — the scan runs and the
    // gap transitions CANDIDATE_FOUND.
    const tick1 = service.tickScheduler({
      now: '2026-10-05T12:00:00.000Z',
      adapters: [ADAPTER],
      principal: PRINCIPAL_SCHEDULER,
      authorizeSchedule: () => ALLOW,
    });
    expect(tick1.ok).toBe(true);
    if (!tick1.ok) return;
    expect(tick1.value).toHaveLength(1);
    expect(tick1.value[0]!.status).toBe('ran');
    const gapsAfter = service.listGaps(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA);
    expect(gapsAfter.ok && gapsAfter.value.every((gap) => gap.state === 'CANDIDATE_FOUND')).toBe(
      true,
    );

    // A tick the next day: not due (weekly cadence).
    const tick2 = service.tickScheduler({
      now: '2026-10-06T12:00:00.000Z',
      adapters: [ADAPTER],
      principal: PRINCIPAL_SCHEDULER,
      authorizeSchedule: () => ALLOW,
    });
    expect(tick2.ok && tick2.value).toHaveLength(0);

    // A tick a week later: due again.
    const tick3 = service.tickScheduler({
      now: '2026-10-12T12:00:00.000Z',
      adapters: [ADAPTER],
      principal: PRINCIPAL_SCHEDULER,
      authorizeSchedule: () => ALLOW,
    });
    expect(tick3.ok && tick3.value).toHaveLength(1);
  });

  it('a denied schedule records the denial and never runs the scan (fail-closed)', () => {
    const service = buildService();
    const seeded = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: gapSeedingInput(),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!seeded.ok) throw new Error(seeded.error.message);
    service.registerSchedule(PRINCIPAL_LEAD, ALLOW, {
      scheduleId: 'sched-weekly-alpha',
      tenantId: TENANT_ALPHA,
      cadence: { kind: 'weekly' },
      adapterIds: ['fixture-catalog'],
      enabled: true,
    });

    const tick = service.tickScheduler({
      now: '2026-10-05T12:00:00.000Z',
      adapters: [ADAPTER],
      principal: PRINCIPAL_SCHEDULER,
      authorizeSchedule: () => ({ allowed: false, reason: 'scheduler principal lacks scope' }),
    });
    expect(tick.ok).toBe(true);
    if (!tick.ok) return;
    expect(tick.value[0]!.status).toBe('authorization-rejected');
    // The gap was NOT transitioned (no scan ran).
    const gaps = service.listGaps(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA, 'UNSATISFIED');
    expect(gaps.ok && gaps.value.length).toBeGreaterThan(0);
  });

  it('event-driven scans go through the service contract directly (no cadence)', () => {
    const service = buildService();
    const seeded = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: gapSeedingInput(),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!seeded.ok) throw new Error(seeded.error.message);
    // An event-triggered scan needs no schedule at all.
    const scan = service.runEcosystemScan({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      trigger: 'event',
      invokedBy: 'event:gap-observed-1',
      adapters: [ADAPTER],
      at: '2026-10-05T10:00:00.000Z',
    });
    expect(scan.ok).toBe(true);
    if (!scan.ok) return;
    expect(scan.value.ingestedCandidates).toHaveLength(1);
  });

  it('an event-cadence schedule is never tick-due', () => {
    const service = buildService();
    service.registerSchedule(PRINCIPAL_LEAD, ALLOW, {
      scheduleId: 'sched-event-alpha',
      tenantId: TENANT_ALPHA,
      cadence: { kind: 'event' },
      adapterIds: ['fixture-catalog'],
      enabled: true,
    });
    const tick = service.tickScheduler({
      now: '2026-10-05T12:00:00.000Z',
      adapters: [ADAPTER],
      principal: PRINCIPAL_SCHEDULER,
      authorizeSchedule: () => ALLOW,
    });
    expect(tick.ok && tick.value).toHaveLength(0);
  });
});
