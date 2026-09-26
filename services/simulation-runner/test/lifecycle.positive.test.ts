// Positive lifecycle coverage over the runner host: intake with REAL W007
// pre-resolution, supervision (plan/execute/publish/cancel), the one-shot
// driver, replay, health, snapshot/restore.
import { describe, expect, it } from 'vitest';
import { ReferenceSimulationExecutionPort, simulationStreamIdOf } from '@epoch/simulation-fabric';
import { runReferenceSimulation } from '@epoch/simulation-protocol';
import { SimulationRunner, driveSimulationJob } from '../src/index';
import {
  ACTOR,
  TENANT,
  T1,
  T2,
  T3,
  T4,
  fixtureRegistry,
  referenceRequestFixture,
  referenceSubmission,
  retiredBinding,
  stressBinding,
  stubPort,
  unwrap,
} from './helpers';

describe('SimulationRunner.submitJob (intake)', () => {
  it('admits a job with bindings pre-resolved against the REAL W007 registry', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    expect(run.status).toBe('submitted');
    expect(run.capabilityBindings).toEqual([stressBinding()]);
  });

  it('a binding that pins a retired capability is the typed lifecycle-conflict', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const submitted = runner.submitJob(
      referenceSubmission({ capabilityBindings: [retiredBinding()] }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('lifecycle-conflict');
      if (submitted.error.code === 'lifecycle-conflict') {
        expect(submitted.error.from).toBe('retired');
      }
    }
  });

  it('a binding that pins an unknown capability is unknown-capability-binding', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const submitted = runner.submitJob(
      referenceSubmission({
        capabilityBindings: [
          { capabilityId: 'engineering.missing', version: '1.0.0', registrationDigest: '0'.repeat(64) },
        ],
      }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('unknown-capability-binding');
    }
  });

  it('a binding whose digest disagrees with the registry record is unknown-capability-binding', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const submitted = runner.submitJob(
      referenceSubmission({
        capabilityBindings: [
          { ...stressBinding(), registrationDigest: 'e'.repeat(64) },
        ],
      }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('unknown-capability-binding');
    }
  });

  it('without a registry the runner plans on opaque references alone', () => {
    const runner = new SimulationRunner();
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    const planned = unwrap(
      runner.planRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
    );
    expect(planned.status).toBe('scheduled');
  });
});

describe('SimulationRunner supervision (plan -> execute -> replay)', () => {
  it('drives a run to completion through the reference adapter', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    unwrap(runner.planRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const executed = unwrap(
      runner.executeRun({
        tenantId: TENANT,
        runId: run.runId,
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        at: T3,
      }),
    );
    expect(executed.disposition).toBe('executed');
    expect(executed.run.status).toBe('completed');
    expect(executed.result!.result.outcome).toEqual({ status: 'completed', outputs: { y: 7 } });
  });

  it('replaying a completed invocation returns the sealed prior result without re-executing', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    unwrap(runner.planRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const port = new ReferenceSimulationExecutionPort();
    unwrap(runner.executeRun({ tenantId: TENANT, runId: run.runId, port, actor: ACTOR, at: T3 }));
    const replay = unwrap(
      runner.executeRun({ tenantId: TENANT, runId: run.runId, port, actor: ACTOR, at: T4 }),
    );
    expect(replay.disposition).toBe('replayed-result');
    expect(port.executionCount).toBe(1);
  });

  it('a failing port settles the run failed and degrades health', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    unwrap(runner.planRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const { port } = stubPort(() => ({
      ok: false,
      failure: { code: 'resource-limit-exceeded', message: 'budget exhausted' },
    }));
    const executed = unwrap(
      runner.executeRun({ tenantId: TENANT, runId: run.runId, port, actor: ACTOR, at: T3 }),
    );
    expect(executed.run.status).toBe('failed');
    const health = runner.health();
    expect(health.status).toBe('degraded');
    expect(health.runsByStatus.failed).toBe(1);
    expect(health.degradedRuns).toEqual([`${TENANT}#${run.runId}`]);
  });

  it('push-style supervision: start then publish a kernel-admitted result', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    unwrap(runner.planRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    unwrap(runner.startRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T3 }));
    // A REAL W005 result document for the same invocation, published push-style.
    const executed = runReferenceSimulation(referenceRequestFixture());
    if (!executed.ok) throw new Error('reference execution must succeed');
    const published = unwrap(
      runner.publishResult({
        tenantId: TENANT,
        runId: run.runId,
        result: executed.run.result,
        actor: ACTOR,
        at: T4,
      }),
    );
    expect(published.run.status).toBe('completed');
    expect(published.result!.result.outcome).toEqual({ status: 'completed', outputs: { y: 7 } });
  });

  it('cancellation and events are surfaced through the runner', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    unwrap(runner.cancelRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const events = unwrap(runner.runEvents({ tenantId: TENANT, runId: run.runId }));
    expect(events.map((e) => e.payload.discriminator)).toEqual([
      'simulation:run-submitted',
      'simulation:run-cancelled',
    ]);
    expect(events[0]!.streamId).toBe(simulationStreamIdOf(run.runId));
  });
});

describe('driveSimulationJob (the one-shot driver)', () => {
  it('drives submission -> planning -> execution in one pass', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const driven = unwrap(
      driveSimulationJob({
        fabric: runner.host,
        tenantId: TENANT,
        registration: referenceSubmission().registration,
        request: referenceSubmission().request,
        capabilityBindings: [stressBinding() as never],
        port: new ReferenceSimulationExecutionPort(),
        admittedCapabilities: undefined,
        actor: ACTOR,
        submittedAt: T1,
        scheduledAt: T2,
        executedAt: T3,
      }),
    );
    expect(driven.run.status).toBe('completed');
    expect(driven.outcome.disposition).toBe('executed');
    expect(driven.run.states.map((s) => s.status)).toEqual([
      'submitted',
      'scheduled',
      'running',
      'completed',
    ]);
  });

  it('short-circuits on the FIRST typed rejection (duplicate-run passthrough)', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const options = {
      fabric: runner.host,
      tenantId: TENANT,
      registration: referenceSubmission().registration,
      request: referenceSubmission().request,
      capabilityBindings: [stressBinding() as never],
      port: new ReferenceSimulationExecutionPort(),
      actor: ACTOR,
      submittedAt: T1,
      scheduledAt: T2,
      executedAt: T3,
    };
    unwrap(driveSimulationJob(options));
    const again = driveSimulationJob(options);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('duplicate-run');
    }
  });

  it('the driver never holds state: two identical drives over fresh hosts agree', () => {
    const first = new SimulationRunner({ registry: fixtureRegistry() });
    const second = new SimulationRunner({ registry: fixtureRegistry() });
    const drive = (runner: SimulationRunner) =>
      driveSimulationJob({
        fabric: runner.host,
        tenantId: TENANT,
        registration: referenceSubmission().registration,
        request: referenceSubmission().request,
        capabilityBindings: [stressBinding() as never],
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        submittedAt: T1,
        scheduledAt: T2,
        executedAt: T3,
      });
    const a = unwrap(drive(first));
    const b = unwrap(drive(second));
    expect(a.run.runDigest).toBe(b.run.runDigest);
    expect(a.outcome.result!.resultDigest).toBe(b.outcome.result!.resultDigest);
    expect(JSON.stringify(first.snapshot())).toBe(JSON.stringify(second.snapshot()));
  });
});

describe('SimulationRunner health + snapshot', () => {
  it('health is healthy with no failed runs and counts by status', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    unwrap(runner.submitJob(referenceSubmission() as never));
    const health = runner.health();
    expect(health.status).toBe('healthy');
    expect(health.runCount).toBe(1);
    expect(health.runsByStatus.submitted).toBe(1);
    expect(health.schemaVersion).toBe(1);
  });

  it('snapshot restores byte-identically through the runner', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    unwrap(runner.planRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const snapshot = runner.snapshot();
    const restored = unwrap(SimulationRunner.fromSnapshot(JSON.parse(JSON.stringify(snapshot))));
    expect(JSON.stringify(restored.snapshot())).toBe(JSON.stringify(snapshot));
    expect(restored.health().runCount).toBe(1);
  });
});
