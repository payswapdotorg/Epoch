// Round-trip serialization + digest verification for every public type:
// JSON.parse(JSON.stringify(x)) re-admits through the validators and
// digests identically (serialization-friendly by construction).
import { describe, expect, it } from 'vitest';
import {
  ReferenceSimulationExecutionPort,
  SealedSimulationEventSchema,
  SimulationEventContentSchema,
  SimulationFabric,
  SimulationRunSchema,
  SimulationRunStateSchema,
  CapabilityBindingRefSchema,
  RunTransitionSchema,
  computeSimulationEventDigest,
  sealSimulationEvent,
  verifyRunStateChain,
  verifySealedSimulationEvent,
} from '../src/index';
import {
  ACTOR,
  TENANT,
  T1,
  T2,
  T3,
  bindingFixture,
  eventContentOf,
  referenceSubmission,
  unwrap,
} from './fixtures';

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('round-trip serialization + digest verification', () => {
  it('a run round-trips and its state chain re-verifies', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const again = SimulationRunSchema.safeParse(roundTrip(run));
    expect(again.success, JSON.stringify(again.error?.issues)).toBe(true);
    if (!again.success) return;
    expect(verifyRunStateChain(again.data).ok).toBe(true);
    expect(again.data.runDigest).toBe(run.runDigest);
  });

  it('a completed run round-trips with its sealed result and re-verifies', () => {
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
    const completed = unwrap(fabric.getRun({ tenantId: TENANT, runId: run.runId }));
    const again = SimulationRunSchema.safeParse(roundTrip(completed));
    expect(again.success).toBe(true);
    if (!again.success) return;
    expect(again.data.status).toBe('completed');
    expect(again.data.result!.resultDigest).toBe(completed.result!.resultDigest);
    expect(verifyRunStateChain(again.data).ok).toBe(true);
  });

  it('every state record round-trips and its digest is content-stable', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const planned = unwrap(fabric.getRun({ tenantId: TENANT, runId: run.runId }));
    for (const state of planned.states) {
      const again = SimulationRunStateSchema.safeParse(roundTrip(state));
      if (!again.success) throw new Error(JSON.stringify(again.error.issues));
      expect(again.data.stateDigest).toBe(state.stateDigest);
      const transition = RunTransitionSchema.safeParse(roundTrip(state.transition));
      if (!transition.success) throw new Error(JSON.stringify(transition.error.issues));
      expect(transition.data.cause).toBe(state.transition.cause);
    }
  });

  it('sealed events round-trip and their digests verify (tamper detection)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const events = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    for (const event of events) {
      const again = SealedSimulationEventSchema.safeParse(roundTrip(event));
      if (!again.success) throw new Error(JSON.stringify(again.error.issues));
      expect(again.data.contentDigest).toBe(event.contentDigest);
      expect(verifySealedSimulationEvent(again.data).ok).toBe(true);
      const content = SimulationEventContentSchema.safeParse(
        eventContentOf(roundTrip(event) as unknown as Record<string, unknown>),
      );
      if (!content.success) throw new Error(JSON.stringify(content.error.issues));
      expect(computeSimulationEventDigest(content.data)).toBe(event.contentDigest);
      // Tampering flips the digest verification.
      const tampered = { ...content.data, occurredAt: T3 };
      expect(verifySealedSimulationEvent(tampered).ok).toBe(false);
    }
  });

  it('capability binding references round-trip', () => {
    const admitted = CapabilityBindingRefSchema.safeParse(roundTrip(bindingFixture()));
    expect(admitted.success).toBe(true);
  });

  it('the whole snapshot round-trips through restore byte-identically', () => {
    const fabric = new SimulationFabric();
    unwrap(fabric.submitJob(referenceSubmission() as never));
    const planned = fabric.planExecution({
      tenantId: TENANT,
      runId: unwrap(fabric.listRuns({ tenantId: TENANT }))[0]!.runId,
      actor: ACTOR,
      at: T2,
    });
    expect(planned.ok).toBe(true);
    const snapshot = fabric.snapshot();
    const restored = SimulationFabric.fromSnapshot(roundTrip(snapshot));
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(JSON.stringify(restored.value.snapshot())).toBe(JSON.stringify(snapshot));
  });

  it('freshly sealed events digest identically after a serialization round-trip', () => {
    const content = {
      schemaVersion: 1,
      streamId: 'stream:simulation-abcdef0123456789',
      sequence: 1,
      tenantId: TENANT,
      actor: ACTOR,
      causalParent: null,
      payload: {
        discriminator: 'simulation:run-scheduled',
        data: {
          runId: 'simrun:abcdef0123456789',
          runDigest: 'a'.repeat(64),
          scheduledAt: T1,
        },
      },
      occurredAt: T1,
    };
    const sealed = unwrap(sealSimulationEvent(content));
    const again = unwrap(sealSimulationEvent(roundTrip(content)));
    expect(again.contentDigest).toBe(sealed.contentDigest);
  });
});
