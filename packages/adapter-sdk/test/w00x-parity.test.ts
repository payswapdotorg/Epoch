// RUNTIME PARITY with the frozen W003/W005/W006 contract shapes: the
// per-category fixtures accepted by the adapter-sdk payload validators
// are the same ones the frozen protocol validators accept, and the same
// corruptions are rejected by both (the W006 evidence->W002
// w002-parity pattern). DevDependencies only — the SDK has NO runtime
// coupling with these packages.
import { describe, expect, it } from 'vitest';
import { ActionTargetSchema } from '@epoch/action-protocol';
import {
  EvaluationSubjectSchema,
  VerdictOutcomeSchema,
} from '@epoch/evaluation-protocol';
import {
  RUN_STATUSES,
  VERIFICATION_STAGES,
} from '@epoch/verification';
import { SimulationOutcomeSchema } from '@epoch/simulation-protocol';
import {
  ActionRequestPayloadSchema,
  EvaluatorRequestPayloadSchema,
  EvaluatorResponsePayloadSchema,
  SimulationRequestPayloadSchema,
  SimulationResponsePayloadSchema,
  VerificationRequestPayloadSchema,
  VerificationResponsePayloadSchema,
} from '../src/index';

// --- W005 simulation ---------------------------------------------------------

const SIMULATION_OUTCOMES: Record<string, unknown>[] = [
  { status: 'completed', outputs: { 'max-stress-mpa': 42.5 } },
  { status: 'failed', failure: { code: 'input-out-of-domain', message: 'load outside validity domain' } },
  { status: 'failed', failure: { code: 'numerical-divergence', message: 'solver diverged' } },
];

const SIMULATION_CORRUPTIONS: Record<string, unknown>[] = [
  { status: 'completed', outputs: {} },
  { status: 'failed', failure: { code: 'solver-crashed', message: 'x' } },
  { status: 'failed', failure: { code: 'internal-error' } },
  { status: 'cancelled' },
  { status: 'completed', outputs: { 'max-stress-mpa': 42.5 }, engine: 'acme-fem' },
];

describe('W005 simulation outcome alignment', () => {
  it('both validators accept the same outcome fixtures', () => {
    for (const [index, fixture] of SIMULATION_OUTCOMES.entries()) {
      expect(SimulationResponsePayloadSchema.safeParse(fixture).success, `sdk ${index}`).toBe(true);
      expect(SimulationOutcomeSchema.safeParse(fixture).success, `w005 ${index}`).toBe(true);
    }
  });

  it('both validators reject the same corruptions (boundary discipline)', () => {
    for (const [index, corruption] of SIMULATION_CORRUPTIONS.entries()) {
      expect(SimulationResponsePayloadSchema.safeParse(corruption).success, `sdk ${index}`).toBe(false);
      expect(SimulationOutcomeSchema.safeParse(corruption).success, `w005 ${index}`).toBe(false);
    }
  });

  it('request inputs share the W005 named-record shape (accept/reject parity)', () => {
    const good = { inputs: { 'load-kn': 12.5, 'mesh-refinement': 'fine' }, seed: 7 };
    const badKey = { inputs: { 'Bad-Key': 1 } };
    const badSeed = { inputs: { 'load-kn': 1 }, seed: -1 };
    const badSeed2 = { inputs: { 'load-kn': 1 }, seed: 1.5 };
    expect(SimulationRequestPayloadSchema.safeParse(good).success).toBe(true);
    expect(SimulationRequestPayloadSchema.safeParse(badKey).success).toBe(false);
    expect(SimulationRequestPayloadSchema.safeParse(badSeed).success).toBe(false);
    expect(SimulationRequestPayloadSchema.safeParse(badSeed2).success).toBe(false);
  });
});

// --- W005 evaluation ----------------------------------------------------------

const EVALUATION_SUBJECTS: Record<string, unknown>[] = [
  { kind: 'simulation-result', subjectId: 'result-fixture-1', subjectDigest: 'a'.repeat(64) },
  { kind: 'world-outcome', subjectId: 'outcome.2', subjectDigest: '0'.repeat(64) },
];

const EVALUATION_VERDICTS: Record<string, unknown>[] = [
  { verdictForm: 'pass-fail', outcome: 'pass' },
  { verdictForm: 'scored', score: 7.5, scale: { minimum: 0, maximum: 10 } },
];

describe('W005 evaluation alignment', () => {
  it('both validators accept the same subject fixtures', () => {
    for (const [index, fixture] of EVALUATION_SUBJECTS.entries()) {
      const wrapped = { subject: fixture, criteria: { 'max-deflection-mm': 5 } };
      expect(EvaluatorRequestPayloadSchema.safeParse(wrapped).success, `sdk ${index}`).toBe(true);
      expect(EvaluationSubjectSchema.safeParse(fixture).success, `w005 ${index}`).toBe(true);
    }
  });

  it('both validators accept the same verdict fixtures', () => {
    for (const [index, fixture] of EVALUATION_VERDICTS.entries()) {
      const wrapped = {
        verdict: fixture,
        justification: [{ kind: 'criterion', reference: 'max-deflection-mm', statement: 'within limit.' }],
      };
      expect(EvaluatorResponsePayloadSchema.safeParse(wrapped).success, `sdk ${index}`).toBe(true);
      expect(VerdictOutcomeSchema.safeParse(fixture).success, `w005 ${index}`).toBe(true);
    }
  });

  it('both validators reject the same subject and verdict corruptions', () => {
    const subjectCorruptions = [
      { kind: 'simulation', subjectId: 'x', subjectDigest: 'a'.repeat(64) },
      { kind: 'simulation-result', subjectId: '', subjectDigest: 'a'.repeat(64) },
      { kind: 'simulation-result', subjectId: 'x', subjectDigest: 'short' },
    ];
    for (const [index, corruption] of subjectCorruptions.entries()) {
      expect(
        EvaluatorRequestPayloadSchema.safeParse({ subject: corruption, criteria: { c: 1 } }).success,
        `sdk ${index}`,
      ).toBe(false);
      expect(EvaluationSubjectSchema.safeParse(corruption).success, `w005 ${index}`).toBe(false);
    }
    const verdictCorruptions = [
      { verdictForm: 'scored', score: 11, scale: { minimum: 0, maximum: 10 } },
      { verdictForm: 'scored', score: 5, scale: { minimum: 10, maximum: 0 } },
      { verdictForm: 'pass-fail', outcome: 'maybe' },
    ];
    for (const [index, corruption] of verdictCorruptions.entries()) {
      expect(
        EvaluatorResponsePayloadSchema.safeParse({
          verdict: corruption,
          justification: [{ kind: 'criterion', reference: 'c', statement: 's' }],
        }).success,
        `sdk ${index}`,
      ).toBe(false);
      expect(VerdictOutcomeSchema.safeParse(corruption).success, `w005 ${index}`).toBe(false);
    }
  });
});

// --- W003 action ---------------------------------------------------------------

const ACTION_TARGETS: Record<string, unknown>[] = [
  { kind: 'world-entity', ref: 'entity:beam-12' },
  { kind: 'external-resource', ref: 'fixture://actuator-1' },
];

describe('W003 action alignment', () => {
  it('both validators accept the same target fixtures', () => {
    for (const [index, fixture] of ACTION_TARGETS.entries()) {
      const wrapped = { target: fixture, parameters: { 'torque-nm': 40 } };
      expect(ActionRequestPayloadSchema.safeParse(wrapped).success, `sdk ${index}`).toBe(true);
      expect(ActionTargetSchema.safeParse(fixture).success, `w003 ${index}`).toBe(true);
    }
  });

  it('both validators reject the same target corruptions', () => {
    const corruptions = [
      { kind: 'world-object', ref: 'x' },
      { kind: 'world-entity', ref: '' },
      { kind: 'external-resource', ref: 'x', vendor: 'acme' },
    ];
    for (const [index, corruption] of corruptions.entries()) {
      expect(
        ActionRequestPayloadSchema.safeParse({ target: corruption, parameters: {} }).success,
        `sdk ${index}`,
      ).toBe(false);
      expect(ActionTargetSchema.safeParse(corruption).success, `w003 ${index}`).toBe(false);
    }
  });
});

// --- W006 verification ----------------------------------------------------------

describe('W006 verification alignment', () => {
  it('the stage vocabulary equals the W006 VERIFICATION_STAGES set', () => {
    const request = {
      method: { methodId: 'm', claimId: 'c', stage: 'verification' },
      inputs: { x: 1 },
    };
    expect(VerificationRequestPayloadSchema.safeParse(request).success).toBe(true);
    for (const stage of VERIFICATION_STAGES) {
      expect(
        VerificationRequestPayloadSchema.safeParse({
          method: { methodId: 'm', claimId: 'c', stage },
          inputs: { x: 1 },
        }).success,
        stage,
      ).toBe(true);
    }
    expect(
      VerificationRequestPayloadSchema.safeParse({
        method: { methodId: 'm', claimId: 'c', stage: 'judgment' },
        inputs: { x: 1 },
      }).success,
    ).toBe(false);
  });

  it('the run-status vocabulary equals the W006 RUN_STATUSES set', () => {
    for (const runStatus of RUN_STATUSES) {
      expect(
        VerificationResponsePayloadSchema.safeParse({ runStatus, producedEvidence: [] }).success,
        runStatus,
      ).toBe(true);
    }
    expect(
      VerificationResponsePayloadSchema.safeParse({ runStatus: 'cancelled', producedEvidence: [] })
        .success,
    ).toBe(false);
  });

  it('produced evidence digests carry the W006 lowercase-hex discipline', () => {
    expect(
      VerificationResponsePayloadSchema.safeParse({
        runStatus: 'completed',
        producedEvidence: ['a'.repeat(64)],
      }).success,
    ).toBe(true);
    expect(
      VerificationResponsePayloadSchema.safeParse({
        runStatus: 'completed',
        producedEvidence: ['XYZ'],
      }).success,
    ).toBe(false);
  });
});
