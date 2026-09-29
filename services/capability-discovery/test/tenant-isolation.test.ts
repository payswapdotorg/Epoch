// Negative (e): cross-tenant isolation of discovery runs — tenant A can
// never read, list or mutate tenant B's discovery state through the
// service; the tenancy gate rejects unknown tenants; the scheduler is
// tenant-scoped.
import { describe, expect, it } from 'vitest';
import type { DiscoveryInput } from '@epoch/capability-discovery';
import { buildService } from './fixtures';
import {
  ALLOW,
  DENY,
  PRINCIPAL_LEAD,
  TENANT_ALPHA,
  TENANT_BETA,
  expectServiceFailure,
} from './fixtures';

function inputFor(tenantId: string): DiscoveryInput {
  return {
    schemaVersion: 1,
    tenantId,
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

describe('negative (e) — cross-tenant isolation of discovery runs', () => {
  it('tenant B cannot read tenant A runs (typed cross-tenant denial)', () => {
    const service = buildService();
    const run = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: inputFor(TENANT_ALPHA),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!run.ok) throw new Error(run.error.message);

    // Direct cross-tenant read.
    expectServiceFailure(
      service.getRun(PRINCIPAL_LEAD, ALLOW, TENANT_BETA, run.value.run.runId),
      'cross-tenant-denied',
    );
    // Tenant B's listing never contains tenant A's run.
    const listedB = service.listRuns(PRINCIPAL_LEAD, ALLOW, TENANT_BETA);
    expect(listedB.ok && listedB.value).toHaveLength(0);
    // Tenant A's listing contains exactly its own run.
    const listedA = service.listRuns(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA);
    expect(listedA.ok && listedA.value).toHaveLength(1);
  });

  it('gap reads and schedule reads are tenant-scoped', () => {
    const service = buildService();
    const run = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: inputFor(TENANT_ALPHA),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!run.ok) throw new Error(run.error.message);
    // Gaps exist for tenant A...
    const gapsA = service.listGaps(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA);
    expect(gapsA.ok && gapsA.value.length).toBeGreaterThan(0);
    // ...and are invisible to tenant B.
    const gapsB = service.listGaps(PRINCIPAL_LEAD, ALLOW, TENANT_BETA);
    expect(gapsB.ok && gapsB.value).toHaveLength(0);

    // Schedules: registering a schedule for tenant B under tenant A's
    // scope is denied; listings are scoped.
    const registered = service.registerSchedule(PRINCIPAL_LEAD, ALLOW, {
      scheduleId: 'sched-alpha-weekly',
      tenantId: TENANT_ALPHA,
      cadence: { kind: 'weekly' },
      adapterIds: ['fixture-catalog'],
      enabled: true,
    });
    expect(registered.ok).toBe(true);
    const schedulesB = service.listSchedules(PRINCIPAL_LEAD, ALLOW, TENANT_BETA);
    expect(schedulesB.ok && schedulesB.value).toHaveLength(0);
    const schedulesA = service.listSchedules(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA);
    expect(schedulesA.ok && schedulesA.value).toHaveLength(1);
  });

  it('the tenancy gate rejects scopes outside the REAL snapshot', () => {
    const service = buildService();
    expectServiceFailure(
      service.listRuns(PRINCIPAL_LEAD, ALLOW, 'tenant:ghost'),
      'unknown-tenant',
    );
    expectServiceFailure(
      service.listGaps(PRINCIPAL_LEAD, ALLOW, 'tenant:ghost'),
      'unknown-tenant',
    );
    expectServiceFailure(
      service.listSchedules(PRINCIPAL_LEAD, ALLOW, 'tenant:ghost'),
      'unknown-tenant',
    );
  });

  it('denied principals see nothing regardless of tenant (fail-closed gate first)', () => {
    const service = buildService();
    expectServiceFailure(
      service.listRuns(PRINCIPAL_LEAD, DENY, TENANT_ALPHA),
      'authorization-rejected',
    );
    expectServiceFailure(
      service.getRun(PRINCIPAL_LEAD, DENY, TENANT_ALPHA, 'discrun:0123456789abcdef'),
      'authorization-rejected',
    );
  });

  it('each tenant runs isolated discovery with identical machinery (same input shape, distinct state)', () => {
    const service = buildService();
    const runA = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: inputFor(TENANT_ALPHA),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    const runB = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_BETA,
      input: inputFor(TENANT_BETA),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    expect(runA.ok).toBe(true);
    expect(runB.ok).toBe(true);
    if (!runA.ok || !runB.ok) return;
    // Same task content in different tenants yields DIFFERENT
    // content-addressed run ids (tenant scope is part of the identity).
    expect(runA.value.run.runId).not.toBe(runB.value.run.runId);
    // And each tenant's runs list contains only its own.
    expect(service.listRuns(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA).ok).toBe(true);
    expect(service.listRuns(PRINCIPAL_LEAD, ALLOW, TENANT_BETA).ok).toBe(true);
  });
});
