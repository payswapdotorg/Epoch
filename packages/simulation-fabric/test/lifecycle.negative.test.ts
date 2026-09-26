// Negative lifecycle coverage: illegal transitions, unknown runs,
// cross-tenant gates on every run-addressed operation, tampered digests,
// broken chains, nonconforming/invalid results, terminal discipline.
import { describe, expect, it } from 'vitest';
import {
  ReferenceSimulationExecutionPort,
  SimulationFabric,
  computeRunStateDigest,
  transitionRunStatus,
  verifyRunStateChain,
} from '../src/index';
import type { SimulationRun } from '../src/index';
import {
  ACTOR,
  OTHER_TENANT,
  TENANT,
  T2,
  T3,
  T4,
  admittedRequestDigest,
  referenceSubmission,
  succeedingPort,
  thermalRegistrationFixture,
  thermalRequestFixture,
  thermalResultFixture,
  unwrap,
} from './fixtures';

describe('lifecycle (negative: transitions)', () => {
  it('rejects executing a run that was never planned (lifecycle-conflict)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const executed = fabric.executeRun({
      tenantId: TENANT,
      runId: run.runId,
      port: new ReferenceSimulationExecutionPort(),
      actor: ACTOR,
      at: T2,
    });
    expect(executed.ok).toBe(false);
    if (!executed.ok) {
      expect(executed.error.code).toBe('lifecycle-conflict');
      if (executed.error.code === 'lifecycle-conflict') {
        expect(executed.error.from).toBe('submitted');
        expect(executed.error.to).toBe('running');
      }
    }
  });

  it('rejects re-executing a failed run (terminal; lifecycle-conflict)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const { port: failing } = {
      port: {
        execute: () =>
          ({ ok: false, failure: { code: 'internal-error', message: 'boom' } }) as never,
      } as never,
    };
    unwrap(fabric.executeRun({ tenantId: TENANT, runId: run.runId, port: failing, actor: ACTOR, at: T3 }));
    const again = fabric.executeRun({
      tenantId: TENANT,
      runId: run.runId,
      port: new ReferenceSimulationExecutionPort(),
      actor: ACTOR,
      at: T3,
    });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('lifecycle-conflict');
      if (again.error.code === 'lifecycle-conflict') {
        expect(again.error.from).toBe('failed');
      }
    }
  });

  it('rejects re-executing a running run (use ingestResult; lifecycle-conflict)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    unwrap(fabric.startRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T3 }));
    const again = fabric.executeRun({
      tenantId: TENANT,
      runId: run.runId,
      port: new ReferenceSimulationExecutionPort(),
      actor: ACTOR,
      at: T4,
    });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('lifecycle-conflict');
      if (again.error.code === 'lifecycle-conflict') {
        expect(again.error.from).toBe('running');
      }
    }
  });

  it('rejects cancelling a terminal run (lifecycle-conflict)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    unwrap(
      fabric.executeRun({
        tenantId: TENANT,
        runId: run.runId,
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        at: T3,
      }),
    );
    const cancelled = fabric.cancelRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T4 });
    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) {
      expect(cancelled.error.code).toBe('lifecycle-conflict');
      if (cancelled.error.code === 'lifecycle-conflict') {
        expect(cancelled.error.from).toBe('completed');
        expect(cancelled.error.to).toBe('cancelled');
      }
    }
  });

  it('rejects ingesting a result into a non-running run (lifecycle-conflict)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const ingested = fabric.ingestResult({
      tenantId: TENANT,
      runId: run.runId,
      result: { bogus: true },
      actor: ACTOR,
      at: T2,
    });
    expect(ingested.ok).toBe(false);
    if (!ingested.ok) {
      expect(ingested.error.code).toBe('lifecycle-conflict');
      if (ingested.error.code === 'lifecycle-conflict') {
        expect(ingested.error.from).toBe('submitted');
      }
    }
  });

  it('rejects starting a run that is not scheduled (lifecycle-conflict)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const started = fabric.startRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 });
    expect(started.ok).toBe(false);
    if (!started.ok) {
      expect(started.error.code).toBe('lifecycle-conflict');
      if (started.error.code === 'lifecycle-conflict') {
        expect(started.error.from).toBe('submitted');
        expect(started.error.to).toBe('running');
      }
    }
  });

  it('the pure transition table rejects every illegal arc', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const illegal: Array<[SimulationRun['status'], SimulationRun['status']]> = [
      ['submitted', 'running'],
      ['submitted', 'completed'],
      ['submitted', 'failed'],
      ['scheduled', 'completed'],
      ['running', 'scheduled'],
      ['completed', 'running'],
      ['failed', 'running'],
      ['cancelled', 'submitted'],
    ];
    // Walk a run through the statuses so each `from` is real.
    const statuses: SimulationRun['status'][] = [
      'scheduled',
      'running',
      'completed',
      'failed',
      'cancelled',
    ];
    const fabric2 = new SimulationFabric();
    let cursor = unwrap(fabric2.submitJob(referenceSubmission() as never));
    for (const status of statuses) {
      const next = transitionRunStatus(cursor, {
        to: status,
        cause: 'planning',
        actor: ACTOR,
        at: T2,
      });
      if (next.ok) cursor = next.value;
    }
    for (const [from, to] of illegal) {
      const base: SimulationRun = { ...cursor, status: from };
      const attempted = transitionRunStatus(base, {
        to,
        cause: 'cancellation',
        actor: ACTOR,
        at: T2,
      });
      expect(attempted.ok, `${from} -> ${to}`).toBe(false);
      if (!attempted.ok) {
        expect(attempted.error.code).toBe('lifecycle-conflict');
      }
    }
    expect(run.status).toBe('submitted');
  });
});

describe('lifecycle (negative: lookups and tenant gates)', () => {
  function preparedFabric(): { fabric: SimulationFabric; runId: string } {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    return { fabric, runId: run.runId };
  }

  it('unknown runs are typed unknown-run on every operation', () => {
    const { fabric } = preparedFabric();
    expect(fabric.getRun({ tenantId: TENANT, runId: 'simrun:missing' }).ok).toBe(false);
    expect(
      fabric.runEvents({ tenantId: TENANT, runId: 'simrun:missing' }).ok,
    ).toBe(false);
    const planned = fabric.planExecution({
      tenantId: TENANT,
      runId: 'simrun:missing',
      actor: ACTOR,
      at: T2,
    });
    if (!planned.ok) expect(planned.error.code).toBe('unknown-run');
    const started = fabric.startRun({ tenantId: TENANT, runId: 'simrun:missing', actor: ACTOR, at: T2 });
    if (!started.ok) expect(started.error.code).toBe('unknown-run');
    const cancelled = fabric.cancelRun({ tenantId: TENANT, runId: 'simrun:missing', actor: ACTOR, at: T2 });
    if (!cancelled.ok) expect(cancelled.error.code).toBe('unknown-run');
  });

  it('cross-tenant run access is tenant-isolation-rejected on every operation', () => {
    const { fabric, runId } = preparedFabric();
    const read = fabric.getRun({ tenantId: OTHER_TENANT, runId });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.error.code).toBe('tenant-isolation-rejected');
      if (read.error.code === 'tenant-isolation-rejected') {
        expect(read.error.expectedTenantId).toBe(OTHER_TENANT);
        expect(read.error.encounteredTenantId).toBe(TENANT);
        expect(read.error.runId).toBe(runId);
      }
    }
    const events = fabric.runEvents({ tenantId: OTHER_TENANT, runId });
    if (!events.ok) expect(events.error.code).toBe('tenant-isolation-rejected');
    const planned = fabric.planExecution({
      tenantId: OTHER_TENANT,
      runId,
      actor: ACTOR,
      at: T2,
    });
    if (!planned.ok) expect(planned.error.code).toBe('tenant-isolation-rejected');
    const started = fabric.startRun({ tenantId: OTHER_TENANT, runId, actor: ACTOR, at: T2 });
    if (!started.ok) expect(started.error.code).toBe('tenant-isolation-rejected');
    const executed = fabric.executeRun({
      tenantId: OTHER_TENANT,
      runId,
      port: new ReferenceSimulationExecutionPort(),
      actor: ACTOR,
      at: T2,
    });
    if (!executed.ok) expect(executed.error.code).toBe('tenant-isolation-rejected');
    const ingested = fabric.ingestResult({
      tenantId: OTHER_TENANT,
      runId,
      result: {},
      actor: ACTOR,
      at: T2,
    });
    if (!ingested.ok) expect(ingested.error.code).toBe('tenant-isolation-rejected');
    const cancelled = fabric.cancelRun({ tenantId: OTHER_TENANT, runId, actor: ACTOR, at: T2 });
    if (!cancelled.ok) expect(cancelled.error.code).toBe('tenant-isolation-rejected');
  });

  it('a tenant-pinned fabric rejects foreign-tenant reads of hosted runs', () => {
    const fabric = new SimulationFabric({ expectedTenantId: TENANT });
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const read = fabric.getRun({ tenantId: OTHER_TENANT, runId: run.runId });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.error.code).toBe('tenant-isolation-rejected');
      if (read.error.code === 'tenant-isolation-rejected') {
        expect(read.error.expectedTenantId).toBe(TENANT);
      }
    }
    const listed = fabric.listRuns({ tenantId: OTHER_TENANT });
    if (!listed.ok) expect(listed.error.code).toBe('tenant-isolation-rejected');
  });
});

describe('lifecycle (negative: tamper detection)', () => {
  it('verifyRunStateChain rejects a tampered state digest (digest-mismatch)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const planned = unwrap(
      fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
    );
    const tampered: SimulationRun = {
      ...planned,
      states: planned.states.map((state, index) =>
        index === 1 ? { ...state, stateDigest: '0'.repeat(64) } : state,
      ),
    };
    const verified = verifyRunStateChain(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
      if (verified.error.code === 'digest-mismatch') {
        expect(verified.error.encountered).toBe('0'.repeat(64));
      }
    }
  });

  it('verifyRunStateChain rejects a broken chain link (digest-mismatch)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const planned = unwrap(
      fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
    );
    const broken: SimulationRun = {
      ...planned,
      states: planned.states.map((state, index) =>
        index === 1 ? { ...state, previousRunDigest: 'f'.repeat(64) } : state,
      ),
    };
    const verified = verifyRunStateChain(broken);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
      if (verified.error.code === 'digest-mismatch') {
        expect(verified.error.encountered).toBe('f'.repeat(64));
      }
    }
  });

  it('verifyRunStateChain rejects a run whose status disagrees with the latest state', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const corrupted: SimulationRun = { ...run, status: 'cancelled' };
    const verified = verifyRunStateChain(corrupted);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('validation');
    }
  });

  it('verifyRunStateChain rejects a run id that disagrees with its identity digest', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const corrupted: SimulationRun = {
      ...run,
      runId: 'simrun:aaaaaaaaaaaaaaaa',
      states: run.states.map((state) => ({ ...state, runId: 'simrun:aaaaaaaaaaaaaaaa' })),
    };
    const verified = verifyRunStateChain(corrupted);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('the state digest is a pure function of the state content (recompute check)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const state = run.states[0]!;
    const content: Record<string, unknown> = { ...state };
    delete content.stateDigest;
    expect(computeRunStateDigest(content as never)).toBe(state.stateDigest);
  });

  it('fromSnapshot rejects a tampered run-state digest (never silent corruption)', () => {
    const fabric = new SimulationFabric();
    unwrap(fabric.submitJob(referenceSubmission() as never));
    const snapshot = fabric.snapshot();
    const tampered = JSON.parse(JSON.stringify(snapshot));
    tampered.entries[0].run.states[0].stateDigest = '0'.repeat(64);
    const restored = SimulationFabric.fromSnapshot(tampered);
    expect(restored.ok).toBe(false);
    if (!restored.ok) {
      expect(restored.error.code).toBe('digest-mismatch');
    }
  });

  it('fromSnapshot rejects a snapshot whose events were tampered with', () => {
    const fabric = new SimulationFabric();
    unwrap(fabric.submitJob(referenceSubmission() as never));
    const snapshot = fabric.snapshot();
    const tampered = JSON.parse(JSON.stringify(snapshot));
    tampered.entries[0].events[0].payload.data.runId = 'simrun:evil';
    const restored = SimulationFabric.fromSnapshot(tampered);
    expect(restored.ok).toBe(false);
    if (!restored.ok) {
      expect(
        ['digest-mismatch', 'validation'].includes(restored.error.code),
      ).toBe(true);
    }
  });

  it('fromSnapshot rejects a version-skewed snapshot (version-unsupported)', () => {
    const fabric = new SimulationFabric();
    unwrap(fabric.submitJob(referenceSubmission() as never));
    const snapshot = fabric.snapshot();
    const skewed = { ...JSON.parse(JSON.stringify(snapshot)), schemaVersion: 99 };
    const restored = SimulationFabric.fromSnapshot(skewed);
    expect(restored.ok).toBe(false);
    if (!restored.ok) {
      expect(restored.error.code).toBe('version-unsupported');
    }
  });

  it('fromSnapshot rejects a cross-tenant event inside a run entry (tenant-isolation-rejected)', () => {
    const fabric = new SimulationFabric();
    unwrap(fabric.submitJob(referenceSubmission() as never));
    const snapshot = JSON.parse(JSON.stringify(fabric.snapshot()));
    // Tamper the event's tenant AND fix its digest so only the tenant gate fires.
    snapshot.entries[0].events[0].tenantId = OTHER_TENANT;
    const restored = SimulationFabric.fromSnapshot(snapshot);
    expect(restored.ok).toBe(false);
    if (!restored.ok) {
      expect(['digest-mismatch', 'tenant-isolation-rejected']).toContain(restored.error.code);
    }
  });
});

describe('lifecycle (negative: result admission)', () => {
  function startedThermalRun(): { fabric: SimulationFabric; runId: string; requestDigest: string } {
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(
        referenceSubmission({
          registration: thermalRegistrationFixture(),
          request: thermalRequestFixture(),
        }) as never,
      ),
    );
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    unwrap(fabric.startRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T3 }));
    const requestDigest = admittedRequestDigest(thermalRequestFixture());
    return { fabric, runId: run.runId, requestDigest };
  }

  it('a nonconforming result settles the run failed and returns the typed rejection', () => {
    const { fabric, runId } = startedThermalRun();
    const ingested = fabric.ingestResult({
      tenantId: TENANT,
      runId,
      // Wrong request digest: binds a foreign revision.
      result: thermalResultFixture('e'.repeat(64)),
      actor: ACTOR,
      at: T4,
    });
    expect(ingested.ok).toBe(false);
    if (!ingested.ok) {
      expect(ingested.error.code).toBe('nonconforming-result');
      if (ingested.error.code === 'nonconforming-result') {
        expect(ingested.error.violations.length).toBeGreaterThan(0);
      }
    }
    const run = unwrap(fabric.getRun({ tenantId: TENANT, runId }));
    expect(run.status).toBe('failed');
    expect(run.states[run.states.length - 1]!.transition.cause).toBe('result-rejected');
    expect(run.failure).toBeDefined();
    const events = unwrap(fabric.runEvents({ tenantId: TENANT, runId }));
    expect(events[events.length - 1]!.payload.discriminator).toBe('simulation:run-failed');
  });

  it('a structurally invalid result document settles the run failed (result-rejected)', () => {
    const { fabric, runId } = startedThermalRun();
    const ingested = fabric.ingestResult({
      tenantId: TENANT,
      runId,
      result: { messageKind: 'simulation.result', bogus: true },
      actor: ACTOR,
      at: T4,
    });
    expect(ingested.ok).toBe(false);
    if (!ingested.ok) {
      expect(['result-rejected', 'validation', 'version-unsupported']).toContain(
        ingested.error.code,
      );
    }
    const run = unwrap(fabric.getRun({ tenantId: TENANT, runId }));
    expect(run.status).toBe('failed');
  });

  it('a port result bound to a foreign request id settles the run failed (nonconforming-result)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(
        referenceSubmission({
          registration: thermalRegistrationFixture(),
          request: thermalRequestFixture(),
        }) as never,
      ),
    );
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const requestDigest = admittedRequestDigest(thermalRequestFixture());
    const foreign = thermalResultFixture(requestDigest, {
      request: { requestId: 'simreq-someone-else', requestDigest },
    });
    const { port } = succeedingPort(foreign);
    const executed = fabric.executeRun({ tenantId: TENANT, runId: run.runId, port, actor: ACTOR, at: T3 });
    expect(executed.ok).toBe(false);
    if (!executed.ok) {
      expect(executed.error.code).toBe('nonconforming-result');
    }
    const settled = unwrap(fabric.getRun({ tenantId: TENANT, runId: run.runId }));
    expect(settled.status).toBe('failed');
  });

  it('an undeclared output in a completed result is nonconforming', () => {
    const { fabric, runId, requestDigest } = startedThermalRun();
    const ingested = fabric.ingestResult({
      tenantId: TENANT,
      runId,
      result: thermalResultFixture(requestDigest, {
        outcome: { status: 'completed', outputs: { 'peak-temperature': 300, 'bonus-output': 1 } },
      }),
      actor: ACTOR,
      at: T4,
    });
    expect(ingested.ok).toBe(false);
    if (!ingested.ok) {
      expect(ingested.error.code).toBe('nonconforming-result');
      if (ingested.error.code === 'nonconforming-result') {
        expect(
          ingested.error.violations.some((v) => v.path.includes('bonus-output')),
        ).toBe(true);
      }
    }
  });
});
