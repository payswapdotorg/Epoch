// ROUND-TRIP SERIALIZATION + DIGEST VERIFICATION for every public
// sealed type: JSON round-trips preserve digests; verify paths detect
// tampering; canonical ordering is stable under key reordering of the
// INPUT JSON (digests are computed over canonical JSON).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SUPERVISION_THRESHOLDS,
  evaluateSupervisionPass,
  sealSupervisionEvent,
  verifySealedSupervisionEvent,
  verifySealedSupervisionPass,
  supervisionStreamIdOf,
  computeSupervisionFindingDigest,
  sealSupervisionFinding,
  deriveFindingId,
} from '../src/index';
import {
  EVAL_IN_WINDOW,
  EVAL_PAST_FINISH,
  PRINCIPAL,
  PROGRAM_ID,
  TENANT,
  T3,
  T4,
  expectError,
  openedDelivery,
  sealedProgram,
  unwrap,
} from './fixtures';

function evaluationInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    passId: 'pass:week-1',
    tenantId: TENANT,
    evaluatedAt: EVAL_IN_WINDOW,
    evaluatedBy: PRINCIPAL,
    program: sealedProgram(),
    delivery: openedDelivery(),
    thresholds: DEFAULT_SUPERVISION_THRESHOLDS,
    executionIssues: [],
    leadTimeInputs: [],
    infoRequests: [],
    ...overrides,
  };
}

describe('round-trip serialization + digest verification', () => {
  it('the sealed pass round-trips through JSON with its digest intact', () => {
    const pass = unwrap(evaluateSupervisionPass(evaluationInput()));
    const json = JSON.stringify(pass);
    const roundTripped = JSON.parse(json);
    const verified = unwrap(verifySealedSupervisionPass(roundTripped));
    expect(verified.contentDigest).toBe(pass.contentDigest);
  });

  it('every sealed finding round-trips and re-derives its digest', () => {
    const pass = unwrap(evaluateSupervisionPass(evaluationInput({ evaluatedAt: EVAL_PAST_FINISH })));
    expect(pass.findings.length).toBeGreaterThan(0);
    for (const finding of pass.findings) {
      const json = JSON.stringify(finding);
      const roundTripped = JSON.parse(json);
      const { contentDigest, ...content } = roundTripped;
      expect(computeSupervisionFindingDigest(content)).toBe(contentDigest);
    }
  });

  it('the pass digest is stable under input key reordering (canonical JSON)', () => {
    const first = unwrap(evaluateSupervisionPass(evaluationInput()));
    const reordered = {
      infoRequests: [],
      leadTimeInputs: [],
      executionIssues: [],
      thresholds: DEFAULT_SUPERVISION_THRESHOLDS,
      delivery: openedDelivery(),
      program: sealedProgram(),
      evaluatedBy: PRINCIPAL,
      evaluatedAt: EVAL_IN_WINDOW,
      tenantId: TENANT,
      passId: 'pass:week-1',
    };
    const second = unwrap(evaluateSupervisionPass(reordered));
    expect(second.contentDigest).toBe(first.contentDigest);
  });

  it('sealed events round-trip with digests intact', () => {
    const event = {
      schemaVersion: 1,
      streamId: supervisionStreamIdOf(PROGRAM_ID),
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: {
        discriminator: 'supervision:finding-produced',
        data: {
          findingId: 'finding:planned-vs-actual-activity-activity-excavate',
          findingDigest: 'a'.repeat(64),
          findingClass: 'planned-vs-actual',
          findingStatus: 'due',
          subjectKind: 'activity',
          subjectId: 'activity:excavate',
          passId: 'pass:week-1',
        },
      },
      occurredAt: T4,
    };
    const sealed = unwrap(sealSupervisionEvent(event));
    const roundTripped = JSON.parse(JSON.stringify(sealed));
    const verified = unwrap(verifySealedSupervisionEvent(roundTripped));
    expect(verified.contentDigest).toBe(sealed.contentDigest);
  });

  it('a hand-built finding content seals and its id derivation is deterministic', () => {
    const content = {
      schema: 'epoch.supervision.finding',
      schemaVersion: 1,
      findingId: deriveFindingId('planned-vs-actual', {
        subjectKind: 'activity',
        subjectId: 'activity:excavate',
      }),
      tenantId: TENANT,
      solutionId: 'solution:tower-retrofit',
      programId: PROGRAM_ID,
      deliveryId: 'delivery:tower-retrofit-v1',
      findingClass: 'planned-vs-actual',
      status: 'due',
      subject: { subjectKind: 'activity', subjectId: 'activity:excavate' },
      title: 'Activity activity:excavate is due',
      detail: 'the activity is inside its plan window and not yet complete',
      measures: {},
      provenance: {
        evaluatedAt: T3,
        evaluatedBy: PRINCIPAL,
        checkVersion: '1.0.0',
        sources: [
          { referenceKind: 'delivery', referenceId: 'delivery:tower-retrofit-v1', contentDigest: 'b'.repeat(64) },
          { referenceKind: 'program', referenceId: PROGRAM_ID, contentDigest: 'a'.repeat(64) },
        ],
      },
    };
    const sealed = unwrap(sealSupervisionFinding(content));
    expect(sealed.findingId).toBe('finding:planned-vs-actual-activity-activity-excavate');
    expect(deriveFindingId('planned-vs-actual', { subjectKind: 'activity', subjectId: 'activity:excavate' })).toBe(
      sealed.findingId,
    );
  });

  it('a finding with unsorted provenance sources is rejected (deterministic serialization)', () => {
    const error = expectError(
      sealSupervisionFinding({
        schema: 'epoch.supervision.finding',
        schemaVersion: 1,
        findingId: 'finding:x',
        tenantId: TENANT,
        solutionId: 'solution:tower-retrofit',
        programId: PROGRAM_ID,
        deliveryId: 'delivery:tower-retrofit-v1',
        findingClass: 'planned-vs-actual',
        status: 'due',
        subject: { subjectKind: 'activity', subjectId: 'activity:excavate' },
        title: 'x',
        detail: 'x',
        measures: {},
        provenance: {
          evaluatedAt: T3,
          evaluatedBy: PRINCIPAL,
          checkVersion: '1.0.0',
          sources: [
            { referenceKind: 'program', referenceId: PROGRAM_ID, contentDigest: 'a'.repeat(64) },
            { referenceKind: 'delivery', referenceId: 'delivery:tower-retrofit-v1', contentDigest: 'b'.repeat(64) },
            { referenceKind: 'activity', referenceId: 'activity:excavate', contentDigest: 'c'.repeat(64) },
          ],
        },
      }),
    );
    expect(error.code).toBe('validation');
  });
});
