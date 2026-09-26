// Negative lifecycle + tenancy coverage over the runner host: tenant
// isolation on every operation, duplicate/idempotency semantics surfaced
// through the façade, lifecycle conflicts, unknown runs.
import { describe, expect, it } from 'vitest';
import { ReferenceSimulationExecutionPort } from '@epoch/simulation-fabric';
import { SimulationRunner } from '../src/index';
import {
  ACTOR,
  OTHER_TENANT,
  TENANT,
  T2,
  fixtureRegistry,
  referenceRequestFixture,
  referenceSubmission,
  unwrap,
} from './helpers';

describe('SimulationRunner tenant isolation (R12)', () => {
  it('a tenant-pinned runner rejects foreign-tenant operations with tenant-isolation-rejected', () => {
    const runner = new SimulationRunner({ expectedTenantId: TENANT, registry: fixtureRegistry() });
    const submitted = runner.submitJob(
      referenceSubmission({ tenantId: OTHER_TENANT }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('tenant-isolation-rejected');
      if (submitted.error.code === 'tenant-isolation-rejected') {
        expect(submitted.error.expectedTenantId).toBe(TENANT);
        expect(submitted.error.encounteredTenantId).toBe(OTHER_TENANT);
      }
    }
  });

  it('cross-tenant run access is tenant-isolation-rejected on every runner operation', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    const cases = [
      runner.getRun({ tenantId: OTHER_TENANT, runId: run.runId }),
      runner.runEvents({ tenantId: OTHER_TENANT, runId: run.runId }),
      runner.planRun({ tenantId: OTHER_TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
      runner.startRun({ tenantId: OTHER_TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
      runner.executeRun({
        tenantId: OTHER_TENANT,
        runId: run.runId,
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        at: T2,
      }),
      runner.publishResult({
        tenantId: OTHER_TENANT,
        runId: run.runId,
        result: {},
        actor: ACTOR,
        at: T2,
      }),
      runner.cancelRun({ tenantId: OTHER_TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
    ];
    for (const outcome of cases) {
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error.code).toBe('tenant-isolation-rejected');
      }
    }
    const listed = runner.listRuns({ tenantId: OTHER_TENANT });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toEqual([]);
    }
  });

  it('a foreign tenant sees the run id is taken but never its state', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    const read = runner.getRun({ tenantId: OTHER_TENANT, runId: run.runId });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.error.code).toBe('tenant-isolation-rejected');
      if (read.error.code === 'tenant-isolation-rejected') {
        expect(read.error.encounteredTenantId).toBe(TENANT);
      }
    }
  });
});

describe('SimulationRunner idempotency (façade passthrough)', () => {
  it('a replayed submission returns the SAME run identity (duplicate-run)', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const first = unwrap(runner.submitJob(referenceSubmission() as never));
    const replay = runner.submitJob(referenceSubmission() as never);
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error.code).toBe('duplicate-run');
      if (replay.error.code === 'duplicate-run') {
        expect(replay.error.runId).toBe(first.runId);
        expect(replay.error.runDigest).toBe(first.runDigest);
      }
    }
  });

  it('different content under a consumed key is idempotency-conflict', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    unwrap(runner.submitJob(referenceSubmission({ idempotencyKey: 'key-a' }) as never));
    const conflict = runner.submitJob(
      referenceSubmission({
        idempotencyKey: 'key-a',
        request: referenceRequestFixture({ requestId: 'simreq-other-0001' }),
      }) as never,
    );
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.error.code).toBe('idempotency-conflict');
    }
  });
});

describe('SimulationRunner lifecycle conflicts', () => {
  it('executing an unplanned run is a lifecycle-conflict', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    const executed = runner.executeRun({
      tenantId: TENANT,
      runId: run.runId,
      port: new ReferenceSimulationExecutionPort(),
      actor: ACTOR,
      at: T2,
    });
    expect(executed.ok).toBe(false);
    if (!executed.ok) {
      expect(executed.error.code).toBe('lifecycle-conflict');
    }
  });

  it('unknown runs are typed unknown-run', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const read = runner.getRun({ tenantId: TENANT, runId: 'simrun:missing' });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.error.code).toBe('unknown-run');
    }
  });

  it('publishing a result into a non-running run is a lifecycle-conflict', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    const published = runner.publishResult({
      tenantId: TENANT,
      runId: run.runId,
      result: {},
      actor: ACTOR,
      at: T2,
    });
    expect(published.ok).toBe(false);
    if (!published.ok) {
      expect(published.error.code).toBe('lifecycle-conflict');
    }
  });

  it('a malformed submission is the kernel validation rejection', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const submitted = runner.submitJob(
      referenceSubmission({ tenantId: 'tenant:BAD' }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('validation');
    }
  });
});
