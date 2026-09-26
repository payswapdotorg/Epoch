// Determinism evidence (the W021 pin): same input -> same run identity +
// same event digests; binding authoring order and arrival order never
// leak into folds, listings, or snapshots.
import { describe, expect, it } from 'vitest';
import {
  ReferenceSimulationExecutionPort,
  SimulationFabric,
  computeRunIdentityDigest,
} from '../src/index';
import {
  ACTOR,
  TENANT,
  T2,
  T3,
  bindingFixture,
  referenceRequestFixture,
  referenceSubmission,
  secondBindingFixture,
  unwrap,
} from './fixtures';

/** A reference-simulator request fixture with a distinct request id. */
function referenceRequestWithId(
  requestId: string,
  inputs: Record<string, number> = { x: 2, slope: 3, intercept: 1 },
): Record<string, unknown> {
  return referenceRequestFixture({ requestId, inputs });
}

describe('determinism', () => {
  it('identical submissions derive identical run identities and event digests', () => {
    const first = new SimulationFabric();
    const second = new SimulationFabric();
    const runA = unwrap(first.submitJob(referenceSubmission() as never));
    const runB = unwrap(second.submitJob(referenceSubmission() as never));
    expect(runA.runId).toBe(runB.runId);
    expect(runA.runDigest).toBe(runB.runDigest);
    expect(runA.stateDigest).toBe(runB.stateDigest);
    const eventsA = unwrap(first.runEvents({ tenantId: TENANT, runId: runA.runId }));
    const eventsB = unwrap(second.runEvents({ tenantId: TENANT, runId: runB.runId }));
    expect(eventsA).toEqual(eventsB);
    expect(JSON.stringify(eventsA)).toBe(JSON.stringify(eventsB));
  });

  it('different content derives a different identity', () => {
    const fabric = new SimulationFabric();
    const runA = unwrap(fabric.submitJob(referenceSubmission() as never));
    const runB = unwrap(
      fabric.submitJob(
        referenceSubmission({
          request: referenceRequestWithId('simreq-reference-0002'),
        }) as never,
      ),
    );
    expect(runA.runDigest).not.toBe(runB.runDigest);
    expect(runA.runId).not.toBe(runB.runId);
  });

  it('binding authoring order never leaks into the identity fold', () => {
    const bindingsA = [bindingFixture(), secondBindingFixture()];
    const bindingsB = [secondBindingFixture(), bindingFixture()];
    const digestA = computeRunIdentityDigest({
      tenantId: TENANT,
      invocation: { requestId: 'simreq-1', requestDigest: 'a'.repeat(64) },
      simulator: { simulatorId: 'simulator:x', registrationDigest: 'b'.repeat(64) },
      capabilityBindings: bindingsA as never,
    });
    const digestB = computeRunIdentityDigest({
      tenantId: TENANT,
      invocation: { requestId: 'simreq-1', requestDigest: 'a'.repeat(64) },
      simulator: { simulatorId: 'simulator:x', registrationDigest: 'b'.repeat(64) },
      capabilityBindings: bindingsB as never,
    });
    expect(digestA).toBe(digestB);
  });

  it('arrival order never leaks into snapshots (two fabrics, same set of runs)', () => {
    const submissionA = referenceSubmission();
    const submissionB = referenceSubmission({
      request: referenceRequestWithId('simreq-reference-0009', { x: 4, slope: 5, intercept: 6 }),
    });

    const fabricOne = new SimulationFabric();
    unwrap(fabricOne.submitJob(submissionA as never));
    unwrap(fabricOne.submitJob(submissionB as never));

    const fabricTwo = new SimulationFabric();
    unwrap(fabricTwo.submitJob(submissionB as never));
    unwrap(fabricTwo.submitJob(submissionA as never));

    expect(fabricOne.snapshot()).toEqual(fabricTwo.snapshot());
    expect(JSON.stringify(fabricOne.snapshot())).toBe(JSON.stringify(fabricTwo.snapshot()));
    const listedOne = unwrap(fabricOne.listRuns({ tenantId: TENANT })).map((r) => r.runId);
    const listedTwo = unwrap(fabricTwo.listRuns({ tenantId: TENANT })).map((r) => r.runId);
    expect(listedOne).toEqual(listedTwo);
    expect(listedOne).toEqual([...listedOne].sort());
  });

  it('the same execution history produces byte-identical completed runs', () => {
    const drive = (): SimulationFabric => {
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
      return fabric;
    };
    const first = drive();
    const second = drive();
    expect(first.snapshot()).toEqual(second.snapshot());
    const runA = unwrap(first.listRuns({ tenantId: TENANT }))[0]!;
    const runB = unwrap(second.listRuns({ tenantId: TENANT }))[0]!;
    expect(runA.result!.resultDigest).toBe(runB.result!.resultDigest);
    expect(runA.stateDigest).toBe(runB.stateDigest);
  });

  it('event digests are stable across independent fabrics (same history)', () => {
    const first = new SimulationFabric();
    const second = new SimulationFabric();
    for (const fabric of [first, second]) {
      const run = unwrap(fabric.submitJob(referenceSubmission() as never));
      unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    }
    const eventsA = unwrap(first.runEvents({ tenantId: TENANT, runId: unwrap(first.listRuns({ tenantId: TENANT }))[0]!.runId }));
    const eventsB = unwrap(second.runEvents({ tenantId: TENANT, runId: unwrap(second.listRuns({ tenantId: TENANT }))[0]!.runId }));
    expect(eventsA.map((e) => e.contentDigest)).toEqual(eventsB.map((e) => e.contentDigest));
  });
});
