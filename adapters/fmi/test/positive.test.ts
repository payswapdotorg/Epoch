// Positive evidence (acceptance: typed participants, deterministic
// steps, W005 registration derivation).
import { describe, expect, it } from 'vitest';
import {
  FmiAdapterHost,
  deriveParticipantRegistration,
  deriveSimulatorRegistration,
  initialStateOf,
  parametersOf,
  portsOfDirection,
  referenceParticipant,
  simulatorIdOf,
  verifyParticipant,
  verifyStep,
} from '../src/index';
import { parseSimulatorRegistration } from '@epoch/simulation-protocol';
import { REFERENCE_PARTICIPANT_ID, REFERENCE_INPUTS, TENANT_A, TENANT_B, adapterSetup, referenceParticipantTyped } from './helpers';

describe('typed participant admission (positive)', () => {
  it('admits a provider descriptor as a typed participant with declared ports', () => {
    const participant = referenceParticipantTyped();
    expect(participant.participantId).toBe(REFERENCE_PARTICIPANT_ID);
    expect(participant.ports.map((port) => port.name)).toEqual([
      'damping',
      'drive-input',
      'position',
      'stiffness',
      'velocity',
    ]);
    const input = portsOfDirection(participant, 'input');
    const output = portsOfDirection(participant, 'output');
    const parameter = portsOfDirection(participant, 'parameter');
    expect(input.map((port) => port.name)).toEqual(['drive-input']);
    expect(output.map((port) => port.name)).toEqual(['position', 'velocity']);
    expect(parameter.map((port) => port.name)).toEqual(['damping', 'stiffness']);
    for (const port of participant.ports) {
      expect(port.valueKind).toBe('number');
      expect(port.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(verifyParticipant(participant)).toBe(true);
  });

  it('admission is idempotent: identical content returns the prior projection', () => {
    const host = new FmiAdapterHost();
    const first = host.admitParticipant({ tenantId: TENANT_A, payload: referenceParticipant() });
    const second = host.admitParticipant({ tenantId: TENANT_A, payload: referenceParticipant() });
    if (!first.ok || !second.ok) throw new Error('admission failed');
    expect(second.value.contentDigest).toBe(first.value.contentDigest);
  });
});

describe('deterministic stepping (positive)', () => {
  it('steps the participant: outputs decay from the prior state under the input drive', () => {
    const { host } = adapterSetup();
    const first = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error.message);
    // decay = 1 / (1 + |0.1| + |1|) = 1/2.1; drive = 1.
    // position: 1/2.1 * 0 + 1 = 1; velocity: 1/2.1 * 0 + 1 = 1.
    expect(first.value.outputs.position).toBeCloseTo(1, 12);
    expect(first.value.outputs.velocity).toBeCloseTo(1, 12);
    expect(first.value.disposition).toBe('stepped');
    expect(verifyStep(first.value)).toBe(true);

    const second = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS },
    });
    if (!second.ok) throw new Error(second.error.message);
    // state advanced: position = 1/2.1 * 1 + 1 = 1.476190...
    expect(second.value.outputs.position).toBeCloseTo(1 / 2.1 + 1, 12);
    expect(second.value.stepNumber).toBe(1);
    expect(second.value.state.values.position).toBe(second.value.outputs.position);
  });

  it('a replayed step key with identical content returns the sealed prior step (duplicate)', () => {
    const { host } = adapterSetup();
    const first = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS },
    });
    if (!first.ok) throw new Error(first.error.message);
    const replay = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      stepNumber: 0,
      values: { ...REFERENCE_INPUTS },
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error(replay.error.message);
    expect(replay.value.disposition).toBe('duplicate');
    expect(replay.value.stepDigest).toBe(first.value.stepDigest);
  });

  it('the initial state and parameters derive from the declared ports', () => {
    const participant = referenceParticipantTyped();
    const state = initialStateOf(participant);
    expect(state.values).toEqual({ position: 0, velocity: 0 });
    expect(parametersOf(participant)).toEqual({ damping: 0.1, stiffness: 1 });
  });
});

describe('W005 simulator-registration derivation (positive)', () => {
  it('derives a pipeline-admissible W005 registration with declared ports as inputs/outputs', () => {
    const participant = referenceParticipantTyped();
    const registration = deriveSimulatorRegistration(participant);
    expect(registration.simulatorId).toBe(simulatorIdOf(participant));
    expect(registration.simulatorId).toBe('simulator:linearplant-reference');
    expect(registration.inputs.map((spec) => spec.name)).toEqual(['drive-input']);
    expect(registration.outputs.map((spec) => spec.name)).toEqual(['position', 'velocity']);
    expect(registration.reproducibility.deterministic).toBe(true);
    // The REAL W005 admission pipeline admits it.
    const admitted = parseSimulatorRegistration(registration);
    expect(admitted.ok).toBe(true);
  });

  it('the composite derivation binds the participant to the registration digest', () => {
    const participant = referenceParticipantTyped();
    const derived = deriveParticipantRegistration({ participant });
    expect(derived.participantId).toBe(REFERENCE_PARTICIPANT_ID);
    expect(derived.registrationDigest).toMatch(/^[0-9a-f]{64}$/);
    const again = deriveParticipantRegistration({ participant });
    expect(again.registrationDigest).toBe(derived.registrationDigest);
  });

  it('the registration digests are stable across independent derivations', () => {
    const a = deriveParticipantRegistration({ participant: referenceParticipantTyped() });
    const b = deriveParticipantRegistration({ participant: referenceParticipantTyped() });
    expect(a.registrationDigest).toBe(b.registrationDigest);
    void TENANT_B;
  });
});
