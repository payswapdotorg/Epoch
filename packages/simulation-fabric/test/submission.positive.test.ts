// Positive submission coverage: deterministic content-addressed identity,
// derived idempotency keys, genesis state records, run-submitted events,
// hosting, listing, snapshotting.
import { describe, expect, it } from 'vitest';
import {
  SimulationFabric,
  computeRunIdentityDigest,
  deriveRunIdempotencyKey,
  runIdOf,
  verifyRunStateChain,
} from '../src/index';
import {
  ACTOR,
  OTHER_ACTOR,
  TENANT,
  T1,
  T2,
  admittedCapabilities,
  bindingFixture,
  referenceRegistrationFixture,
  referenceRequestFixture,
  referenceSubmission,
  secondBindingFixture,
  thermalRequestFixture,
  thermalRegistrationFixture,
  unwrap,
} from './fixtures';

describe('submitJob (positive)', () => {
  it('admits a conforming job and hosts the run in status submitted', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    expect(run.status).toBe('submitted');
    expect(run.tenantId).toBe(TENANT);
    expect(run.states).toHaveLength(1);
    expect(run.states[0]!.transition).toEqual({
      from: null,
      to: 'submitted',
      cause: 'submission',
      actor: ACTOR,
      at: T1,
    });
    expect(run.createdAt).toBe(T1);
    expect(fabric.runCount).toBe(1);
  });

  it('derives the run identity from the canonical invocation payload (content-addressed)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const expectedDigest = computeRunIdentityDigest({
      tenantId: TENANT,
      invocation: run.invocation,
      simulator: run.simulator,
      capabilityBindings: run.capabilityBindings,
    });
    expect(run.runDigest).toBe(expectedDigest);
    expect(run.runId).toBe(runIdOf(expectedDigest));
  });

  it('derives the idempotency key from the identity scope when none is supplied', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    expect(run.idempotencyKey).toBe(
      deriveRunIdempotencyKey({ tenantId: TENANT, runDigest: run.runDigest }),
    );
  });

  it('accepts a caller-supplied idempotency key within the grammar', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(referenceSubmission({ idempotencyKey: 'job-batch-0001' }) as never),
    );
    expect(run.idempotencyKey).toBe('job-batch-0001');
  });

  it('binds capability registrations as opaque typed references, canonically ordered', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(
        referenceSubmission({
          capabilityBindings: [secondBindingFixture(), bindingFixture()],
        }) as never,
      ),
    );
    // Sorted by capabilityId — authoring order never leaks.
    expect(run.capabilityBindings.map((b) => b.capabilityId)).toEqual([
      'engineering.meshing',
      'engineering.stress-analysis',
    ]);
    expect(Object.keys(run.capabilityBindings[0]!)).toEqual([
      'capabilityId',
      'version',
      'registrationDigest',
    ]);
  });

  it('seals and verifies the genesis state chain', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    expect(verifyRunStateChain(run).ok).toBe(true);
    expect(run.states[0]!.previousRunDigest).toBeNull();
    expect(run.stateDigest).toBe(run.states[0]!.stateDigest);
  });

  it('emits the run-submitted event as sequence 1 of the run stream', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const events = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    expect(events).toHaveLength(1);
    const [first] = events;
    expect(first!.streamId).toBe(`stream:simulation-${run.runId.slice('simrun:'.length)}`);
    expect(first!.sequence).toBe(1);
    expect(first!.causalParent).toBeNull();
    expect(first!.tenantId).toBe(TENANT);
    expect(first!.actor).toBe(ACTOR);
    expect(first!.occurredAt).toBe(T1);
    expect(first!.payload.discriminator).toBe('simulation:run-submitted');
    expect(first!.payload.data).toMatchObject({
      runId: run.runId,
      runDigest: run.runDigest,
      requestId: 'simreq-reference-0001',
      simulatorId: 'simulator:reference-affine-scalar',
      idempotencyKey: run.idempotencyKey,
      submittedAt: T1,
    });
  });

  it('admits a distinct simulator contract with its own request (provider-neutral)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(
        referenceSubmission({
          registration: thermalRegistrationFixture(),
          request: thermalRequestFixture(),
        }) as never,
      ),
    );
    expect(run.simulator.simulatorId).toBe('simulator:thermal-steady-state');
    expect(run.status).toBe('submitted');
  });

  it('hosts runs of multiple tenants side by side; listing is tenant-scoped and sorted', () => {
    const fabric = new SimulationFabric();
    const first = unwrap(
      fabric.submitJob(referenceSubmission({ tenantId: 'tenant:acme', actor: ACTOR }) as never),
    );
    const second = unwrap(
      fabric.submitJob(
        referenceSubmission({
          tenantId: 'tenant:bridge',
          actor: OTHER_ACTOR,
          request: referenceRequestFixture({ requestId: 'simreq-bridge-0001' }),
        }) as never,
      ),
    );
    expect(fabric.runCount).toBe(2);
    const acme = unwrap(fabric.listRuns({ tenantId: 'tenant:acme' }));
    expect(acme.map((r) => r.runId)).toEqual([first.runId]);
    const bridge = unwrap(fabric.listRuns({ tenantId: 'tenant:bridge' }));
    expect(bridge.map((r) => r.runId)).toEqual([second.runId]);
  });

  it('snapshots deterministically with the idempotency bookkeeping', () => {
    const fabric = new SimulationFabric();
    unwrap(fabric.submitJob(referenceSubmission() as never));
    const snapshot = fabric.snapshot();
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.idempotency).toHaveLength(1);
    expect(snapshot.idempotency[0]!.tenantId).toBe(TENANT);
    expect(fabric.idempotencyKeyCount).toBe(1);
  });

  it('planning resolves every binding against the admitted capability set', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const planned = unwrap(
      fabric.planExecution({
        tenantId: TENANT,
        runId: run.runId,
        admittedCapabilities: admittedCapabilities() as never,
        actor: ACTOR,
        at: T2,
      }),
    );
    expect(planned.status).toBe('scheduled');
    expect(planned.states).toHaveLength(2);
    expect(planned.states[1]!.previousRunDigest).toBe(run.stateDigest);
    expect(planned.states[1]!.transition).toEqual({
      from: 'submitted',
      to: 'scheduled',
      cause: 'planning',
      actor: ACTOR,
      at: T2,
    });
  });

  it('the admitted registration fixture round-trips through the W005 pipeline', () => {
    // Guard: the loose fixtures must stay admittable (digest-accurate).
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(
        referenceSubmission({
          registration: referenceRegistrationFixture(),
          request: referenceRequestFixture(),
        }) as never,
      ),
    );
    expect(run.invocation.requestId).toBe('simreq-reference-0001');
  });
});
