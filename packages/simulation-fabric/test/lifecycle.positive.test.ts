// Positive lifecycle coverage: planning, pull-style execution through the
// reference adapter, push-style start+ingest, cancellation, replay, and
// the event stream discipline.
import { describe, expect, it } from 'vitest';
import {
  ReferenceSimulationExecutionPort,
  SimulationFabric,
  isTerminalRunStatus,
  verifyRunStateChain,
} from '../src/index';
import type { SealedSimulationEvent } from '../src/index';
import {
  ACTOR,
  TENANT,
  T2,
  T3,
  T4,
  T5,
  admittedCapabilities,
  admittedRequestDigest,
  referenceSubmission,
  succeedingPort,
  thermalRegistrationFixture,
  thermalRequestFixture,
  thermalResultFixture,
  unwrap,
} from './fixtures';

describe('executeRun (pull-style, reference adapter)', () => {
  it('drives a scheduled run to completed through the reference adapter', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(
      fabric.planExecution({
        tenantId: TENANT,
        runId: run.runId,
        admittedCapabilities: admittedCapabilities() as never,
        actor: ACTOR,
        at: T2,
      }),
    );
    const port = new ReferenceSimulationExecutionPort();
    const executed = unwrap(
      fabric.executeRun({
        tenantId: TENANT,
        runId: run.runId,
        port,
        actor: ACTOR,
        at: T3,
      }),
    );
    expect(executed.disposition).toBe('executed');
    expect(executed.run.status).toBe('completed');
    expect(executed.result).toBeDefined();
    // The reference simulator computes y = 3 * 2 + 1 = 7.
    expect(executed.result!.result.outcome).toEqual({
      status: 'completed',
      outputs: { y: 7 },
    });
    expect(executed.failure).toBeUndefined();
    expect(port.executionCount).toBe(1);
    expect(isTerminalRunStatus(executed.run.status)).toBe(true);
    expect(verifyRunStateChain(executed.run).ok).toBe(true);
    expect(executed.run.states.map((s) => s.status)).toEqual([
      'submitted',
      'scheduled',
      'running',
      'completed',
    ]);
  });

  it('emits the full lifecycle event stream for the pull path (5 events, causal chain)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(
      fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
    );
    unwrap(
      fabric.executeRun({
        tenantId: TENANT,
        runId: run.runId,
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        at: T3,
      }),
    );
    const events = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    expect(events.map((e) => e.payload.discriminator)).toEqual([
      'simulation:run-submitted',
      'simulation:run-scheduled',
      'simulation:run-started',
      'simulation:run-completed',
      'simulation:result-published',
    ]);
    expect(events.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(events[0]!.causalParent).toBeNull();
    for (let index = 1; index < events.length; index += 1) {
      expect(events[index]!.causalParent).toEqual({
        streamId: events[0]!.streamId,
        sequence: index,
      });
    }
    const completed = events[3]!;
    expect(completed.payload.data).toMatchObject({ outcomeStatus: 'completed' });
    const published = events[4]!;
    expect(published.payload.data).toMatchObject({ resultId: expect.any(String) });
  });

  it('replaying a completed invocation returns the sealed prior result WITHOUT re-executing', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(
      fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
    );
    const port = new ReferenceSimulationExecutionPort();
    const first = unwrap(
      fabric.executeRun({ tenantId: TENANT, runId: run.runId, port, actor: ACTOR, at: T3 }),
    );
    expect(port.executionCount).toBe(1);
    const replay = unwrap(
      fabric.executeRun({ tenantId: TENANT, runId: run.runId, port, actor: ACTOR, at: T4 }),
    );
    expect(replay.disposition).toBe('replayed-result');
    expect(replay.result!.resultDigest).toBe(first.result!.resultDigest);
    expect(replay.result!.result).toEqual(first.result!.result);
    // No re-execution, no new events, state unchanged.
    expect(port.executionCount).toBe(1);
    expect(unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }))).toHaveLength(5);
    expect(replay.run.stateDigest).toBe(first.run.stateDigest);
  });

  it('settles a run as failed when the port reports an execution failure', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(
      fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
    );
    const { port } = (() => {
      return {
        port: {
          execute: () =>
            ({
              ok: false,
              failure: { code: 'resource-limit-exceeded', message: 'wall-clock budget exhausted' },
            }) as never,
        } as never,
      };
    })();
    const executed = unwrap(
      fabric.executeRun({ tenantId: TENANT, runId: run.runId, port, actor: ACTOR, at: T3 }),
    );
    expect(executed.disposition).toBe('executed');
    expect(executed.run.status).toBe('failed');
    expect(executed.failure).toEqual({
      code: 'resource-limit-exceeded',
      message: 'wall-clock budget exhausted',
    });
    expect(executed.run.states.map((s) => s.status)).toEqual([
      'submitted',
      'scheduled',
      'running',
      'failed',
    ]);
    expect(executed.run.states[3]!.transition.cause).toBe('execution-failed');
    const events = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    expect(events[3]!.payload.discriminator).toBe('simulation:run-failed');
    expect(events[3]!.payload.data).toMatchObject({
      failureCode: 'resource-limit-exceeded',
    });
  });
});

describe('startRun + ingestResult (push-style)', () => {
  it('starts a scheduled run and publishes an admitted result', () => {
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
    const started = unwrap(
      fabric.startRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T3 }),
    );
    expect(started.status).toBe('running');

    const requestDigest = admittedRequestDigest(thermalRequestFixture());
    const ingested = unwrap(
      fabric.ingestResult({
        tenantId: TENANT,
        runId: run.runId,
        result: thermalResultFixture(requestDigest),
        actor: ACTOR,
        at: T4,
      }),
    );
    expect(ingested.disposition).toBe('executed');
    expect(ingested.run.status).toBe('completed');
    expect(ingested.result!.result.outcome.status).toBe('completed');
    expect(ingested.run.states.map((s) => s.status)).toEqual([
      'submitted',
      'scheduled',
      'running',
      'completed',
    ]);
    const events = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    expect(events.map((e) => e.payload.discriminator)).toEqual([
      'simulation:run-submitted',
      'simulation:run-scheduled',
      'simulation:run-started',
      'simulation:run-completed',
      'simulation:result-published',
    ]);
  });

  it('a stub port returning a valid result document also completes the run', () => {
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
    const { port, calls } = succeedingPort(thermalResultFixture(requestDigest));
    const executed = unwrap(
      fabric.executeRun({ tenantId: TENANT, runId: run.runId, port, actor: ACTOR, at: T3 }),
    );
    expect(executed.run.status).toBe('completed');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.request.requestId).toBe('simreq-thermal-0001');
    expect(calls[0]!.registration.simulatorId).toBe('simulator:thermal-steady-state');
    expect(calls[0]!.capabilityBindings).toEqual(executed.run.capabilityBindings);
  });
});

describe('cancelRun (positive)', () => {
  it('cancels a submitted run with the typed transition and event', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const cancelled = unwrap(
      fabric.cancelRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }),
    );
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.states[1]!.transition).toEqual({
      from: 'submitted',
      to: 'cancelled',
      cause: 'cancellation',
      actor: ACTOR,
      at: T2,
    });
    const events = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    expect(events.map((e) => e.payload.discriminator)).toEqual([
      'simulation:run-submitted',
      'simulation:run-cancelled',
    ]);
  });

  it('cancels a scheduled and a running run as well', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    unwrap(fabric.startRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T3 }));
    const cancelled = unwrap(
      fabric.cancelRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T4 }),
    );
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.states.map((s) => s.status)).toEqual([
      'submitted',
      'scheduled',
      'running',
      'cancelled',
    ]);
  });
});

describe('snapshot / restore (positive)', () => {
  it('restores a completed run fabric byte-identically (idempotency bookkeeping included)', () => {
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
    const snapshot = fabric.snapshot();
    const restored = unwrap(SimulationFabric.fromSnapshot(JSON.parse(JSON.stringify(snapshot))));
    expect(restored.snapshot()).toEqual(snapshot);
    // Replay semantics survive the restore.
    const replay = unwrap(
      restored.executeRun({
        tenantId: TENANT,
        runId: run.runId,
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        at: T5,
      }),
    );
    expect(replay.disposition).toBe('replayed-result');
    const duplicate = restored.submitJob(referenceSubmission() as never);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe('duplicate-run');
    }
  });

  it('restored events are byte-identical sealed records', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const before: readonly SealedSimulationEvent[] = unwrap(
      fabric.runEvents({ tenantId: TENANT, runId: run.runId }),
    );
    const restored = unwrap(SimulationFabric.fromSnapshot(fabric.snapshot()));
    const after = unwrap(restored.runEvents({ tenantId: TENANT, runId: run.runId }));
    expect(after).toEqual(before);
  });
});
