// Determinism + replay evidence (acceptance: identical inputs -> identical
// step digests; idempotent step replay).
import { describe, expect, it } from 'vitest';
import {
  FmiAdapterHost,
  computeStep,
  deriveParticipantRegistration,
  initialStateOf,
  referenceParticipant,
  verifyStep,
} from '../src/index';
import { REFERENCE_PARTICIPANT_ID, REFERENCE_INPUTS, TENANT_A, adapterSetup, pinFor, registryWithAdapter, referenceParticipantTyped } from './helpers';

describe('determinism', () => {
  it('identical step computations produce identical step digests (pure function)', () => {
    const participant = referenceParticipantTyped();
    const prior = initialStateOf(participant);
    const inputs = { ...REFERENCE_INPUTS };
    const a = computeStep({
      tenantId: TENANT_A,
      participant,
      stepNumber: 0,
      inputs,
      priorState: prior,
      steppedAt: '2026-03-01T00:00:00.000Z',
    });
    const b = computeStep({
      tenantId: TENANT_A,
      participant,
      stepNumber: 0,
      inputs,
      priorState: prior,
      steppedAt: '2026-03-01T00:00:00.000Z',
    });
    expect(a.stepDigest).toBe(b.stepDigest);
    expect(a.outputs).toEqual(b.outputs);
    expect(a.state.stateDigest).toBe(b.state.stateDigest);
  });

  it('different inputs produce different step digests', () => {
    const participant = referenceParticipantTyped();
    const prior = initialStateOf(participant);
    const a = computeStep({
      tenantId: TENANT_A,
      participant,
      stepNumber: 0,
      inputs: { 'drive-input': 1 },
      priorState: prior,
      steppedAt: '2026-03-01T00:00:00.000Z',
    });
    const b = computeStep({
      tenantId: TENANT_A,
      participant,
      stepNumber: 0,
      inputs: { 'drive-input': 2 },
      priorState: prior,
      steppedAt: '2026-03-01T00:00:00.000Z',
    });
    expect(a.stepDigest).not.toBe(b.stepDigest);
  });

  it('independent hosts fed the same step sequence produce identical step digests', () => {
    const setupA = adapterSetup();
    const setupB = adapterSetup();
    const digests: string[][] = [[], []];
    for (const setup of [setupA, setupB]) {
      for (let stepNumber = 0; stepNumber < 5; stepNumber += 1) {
        const step = setup.host.step({
          tenantId: TENANT_A,
          participantId: REFERENCE_PARTICIPANT_ID,
          values: { 'drive-input': 1 + stepNumber * 0.5 },
        });
        if (!step.ok) throw new Error(step.error.message);
        digests[setup === setupA ? 0 : 1].push(step.value.stepDigest);
      }
    }
    expect(digests[0]).toEqual(digests[1]);
  });

  it('a replayed step never advances the state (the sealed exchange stands)', () => {
    const { host } = adapterSetup();
    const first = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS },
    });
    if (!first.ok) throw new Error(first.error.message);
    const stateAfterFirst = host.currentState(TENANT_A, REFERENCE_PARTICIPANT_ID);
    if (!stateAfterFirst.ok) throw new Error(stateAfterFirst.error.message);
    const replay = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      stepNumber: 0,
      values: { ...REFERENCE_INPUTS },
    });
    if (!replay.ok) throw new Error(replay.error.message);
    expect(replay.value.disposition).toBe('duplicate');
    const stateAfterReplay = host.currentState(TENANT_A, REFERENCE_PARTICIPANT_ID);
    if (!stateAfterReplay.ok) throw new Error(stateAfterReplay.error.message);
    expect(stateAfterReplay.value.stateDigest).toBe(stateAfterFirst.value.stateDigest);
  });

  it('the W007 simulation envelope is deterministic across independent invocations', async () => {
    const setupA = adapterSetup();
    const setupB = adapterSetup();
    const registry = registryWithAdapter();
    const pinA = pinFor(setupA.adapter, registry);
    const pinB = pinFor(setupB.adapter, registry);
    const request = {
      schemaVersion: 1 as const,
      category: 'simulation' as const,
      binding: pinA,
      payload: {
        inputs: {
          tenant: TENANT_A,
          participant: REFERENCE_PARTICIPANT_ID,
          values: { ...REFERENCE_INPUTS },
        },
      },
    };
    const a = await setupA.adapter.invoke({ ...request, binding: pinA });
    const b = await setupB.adapter.invoke({ ...request, binding: pinB });
    expect(a.payload).toEqual(b.payload);
    if (a.payload.status === 'completed' && b.payload.status === 'completed') {
      expect(a.payload.outputs['step-digest']).toBe(b.payload.outputs['step-digest']);
    }
  });

  it('registration derivation is deterministic (same participant -> same registration digest)', () => {
    const a = deriveParticipantRegistration({ participant: referenceParticipantTyped() });
    const b = deriveParticipantRegistration({ participant: referenceParticipantTyped() });
    expect(a.registrationDigest).toBe(b.registrationDigest);
  });

  it('admission is deterministic (independent hosts -> identical participant digests)', () => {
    const hostA = new FmiAdapterHost();
    const hostB = new FmiAdapterHost();
    const a = hostA.admitParticipant({ tenantId: TENANT_A, payload: referenceParticipant() });
    const b = hostB.admitParticipant({ tenantId: TENANT_A, payload: referenceParticipant() });
    if (!a.ok || !b.ok) throw new Error('admission failed');
    expect(a.value.contentDigest).toBe(b.value.contentDigest);
    expect(verifyStep.name).toBe('verifyStep');
  });
});
