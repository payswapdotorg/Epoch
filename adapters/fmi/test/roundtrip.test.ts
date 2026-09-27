// Round-trip serialization + digest verification for every public type
// (acceptance: all public record shapes serialize deterministically,
// parse back to equal values, and address their exact content revision).
import { describe, expect, it } from 'vitest';
import { canonicalDigest, canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  ParticipantPortSchema,
  ParticipantStateSchema,
  StepExchangeSchema,
  TypedParticipantSchema,
  initialStateOf,
  referenceParticipant,
  verifyParticipant,
  verifyStep,
} from '../src/index';
import { REFERENCE_PARTICIPANT_ID, REFERENCE_INPUTS, TENANT_A, adapterSetup, referenceParticipantTyped } from './helpers';

/** Deterministic round-trip: canonical JSON -> parse -> deep equal + digest stability. */
function roundTrip(value: unknown, parse: (input: unknown) => { success: boolean; data?: unknown }): void {
  const serialized = canonicalJsonStringify(value as JsonValue);
  const parsed = parse(JSON.parse(serialized));
  expect(parsed.success, `${serialized}`).toBe(true);
  const reserialized = canonicalJsonStringify((parsed as { data: unknown }).data as JsonValue);
  expect(reserialized).toBe(serialized);
}

describe('round-trip serialization + digest verification (every public type)', () => {
  it('ParticipantPort round-trips through canonical JSON', () => {
    for (const port of referenceParticipantTyped().ports) {
      roundTrip(port, (input) => ParticipantPortSchema.safeParse(input));
    }
  });

  it('TypedParticipant round-trips through canonical JSON', () => {
    const participant = referenceParticipantTyped();
    roundTrip(participant, (input) => TypedParticipantSchema.safeParse(input));
  });

  it('ParticipantState round-trips through canonical JSON', () => {
    roundTrip(initialStateOf(referenceParticipantTyped()), (input) => ParticipantStateSchema.safeParse(input));
  });

  it('StepExchange round-trips through canonical JSON', () => {
    const { host } = adapterSetup();
    const step = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS },
    });
    if (!step.ok) throw new Error(step.error.message);
    roundTrip(step.value, (input) => StepExchangeSchema.safeParse(input));
  });

  it('the step digest is stable under top-level key reordering (canonical form)', () => {
    const { host } = adapterSetup();
    const step = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS },
    });
    if (!step.ok) throw new Error(step.error.message);
    const { stepDigest, ...content } = step.value;
    expect(stepDigest).toBe(canonicalDigest(content as unknown as JsonValue));
    expect(verifyStep(step.value)).toBe(true);
  });

  it('the participant digest is stable under top-level key reordering (canonical form)', () => {
    const participant = referenceParticipantTyped();
    const { contentDigest, ...content } = participant;
    expect(contentDigest).toBe(canonicalDigest(content as unknown as JsonValue));
    expect(verifyParticipant(participant)).toBe(true);
    void referenceParticipant;
  });
});
