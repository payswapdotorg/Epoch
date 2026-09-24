// Shared fixtures for the verification tests. Builders return loose JSON
// objects so negative tests can corrupt single fields/records precisely.
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  computeEvidenceDigest,
  parseEvidenceRecord,
  type EvidenceRecord,
} from '@epoch/evidence';

export const T0 = '2025-06-01T08:00:00.000Z';
export const T1 = '2025-06-01T09:30:00.000Z';
export const T2 = '2025-06-01T11:00:00.000Z';
export const T3 = '2025-06-01T12:00:00.000Z';
export const T4 = '2025-06-01T13:00:00.000Z';

export const ARTIFACT: JsonValue = { report: 'structural-analysis', revision: 3 };
export const ARTIFACT_DIGEST = canonicalDigest(ARTIFACT);

/** Build a parsed (typed) evidence record for the fixture run. */
export function makeEvidence(overrides: Record<string, unknown> = {}): EvidenceRecord {
  const parsed = parseEvidenceRecord({
    schemaVersion: 1,
    kind: 'measurement',
    subject: { artifactId: 'artifact:structural-report', revision: 'r3', digest: ARTIFACT_DIGEST },
    producedBy: {
      runId: 'run:stress-check-1',
      actorId: 'actor:solver-01',
      methodId: 'method:deflection-check',
    },
    observedAt: T1,
    content: { mediaType: 'application/json', data: { deflectionMm: 4.2, withinLimit: true } },
    confidence: { distribution: { kind: 'interval', lower: 0.9, upper: 0.98 }, method: 'measured' },
    ...overrides,
  });
  if (!parsed.ok) throw new Error(`fixture evidence record is invalid: ${parsed.issues[0]?.message}`);
  return parsed.record;
}

export const EVIDENCE = makeEvidence();
export const EVIDENCE_DIGEST = computeEvidenceDigest(EVIDENCE);

/** A complete, valid verification chain (verification stage) as loose JSON. */
export function verificationChain(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    requirements: [
      { schemaVersion: 1, requirementId: 'req:struct-001', statement: 'Beam deflection stays below 5mm under rated load.' },
    ],
    claims: [
      {
        schemaVersion: 1,
        claimId: 'claim:deflection-check',
        requirementId: 'req:struct-001',
        statement: 'Measured deflection under rated load is below 5mm.',
        stage: 'verification',
      },
    ],
    methods: [
      {
        schemaVersion: 1,
        methodId: 'method:deflection-check',
        claimId: 'claim:deflection-check',
        stage: 'verification',
        description: 'Run the FE solver at rated load and read the mid-span deflection.',
        deterministic: true,
      },
    ],
    runs: [
      {
        schemaVersion: 1,
        runId: 'run:stress-check-1',
        methodId: 'method:deflection-check',
        stage: 'verification',
        executedBy: 'actor:solver-01',
        executedByKind: 'software',
        startedAt: T0,
        endedAt: T1,
        status: 'completed',
        producedEvidence: [EVIDENCE_DIGEST],
      },
    ],
    evidence: [EVIDENCE],
    results: [
      {
        schemaVersion: 1,
        resultId: 'result:res-1',
        claimId: 'claim:deflection-check',
        runId: 'run:stress-check-1',
        stage: 'verification',
        outcome: 'pass',
        evidenceDigests: [EVIDENCE_DIGEST],
        confidence: { distribution: { kind: 'interval', lower: 0.9, upper: 0.98 }, method: 'measured' },
        decidedAt: T2,
        rationale: '4.2mm < 5mm limit with calibrated sensors.',
      },
    ],
    approvals: [
      {
        schemaVersion: 1,
        approvalId: 'approval:signoff-1',
        resultId: 'result:res-1',
        approverId: 'actor:reviewer-01',
        approverKind: 'person',
        decision: 'approved',
        decidedAt: T3,
        rationale: 'Evidence is calibrated and the margin is comfortable.',
      },
    ],
    ...overrides,
  };
}

/** A complete, valid VALIDATION-stage chain (same shape, stage: validation). */
export function validationChain(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const evidence = makeEvidence({
    producedBy: { runId: 'run:spec-review-1', actorId: 'actor:domain-expert-01', methodId: 'method:spec-review' },
    kind: 'assertion',
    confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'stated' },
  });
  const evidenceDigest = computeEvidenceDigest(evidence);
  return verificationChain({
    requirements: [
      { schemaVersion: 1, requirementId: 'req:struct-001', statement: 'The 5mm deflection limit is the right limit for this span and load.' },
    ],
    claims: [
      {
        schemaVersion: 1,
        claimId: 'claim:limit-adequacy',
        requirementId: 'req:struct-001',
        statement: 'The 5mm deflection limit is adequate for occupant comfort on this span.',
        stage: 'validation',
      },
    ],
    methods: [
      {
        schemaVersion: 1,
        methodId: 'method:spec-review',
        claimId: 'claim:limit-adequacy',
        stage: 'validation',
        description: 'Domain-expert review of the limit against comfort criteria and precedent.',
        deterministic: false,
      },
    ],
    runs: [
      {
        schemaVersion: 1,
        runId: 'run:spec-review-1',
        methodId: 'method:spec-review',
        stage: 'validation',
        executedBy: 'actor:domain-expert-01',
        executedByKind: 'person',
        startedAt: T0,
        endedAt: T1,
        status: 'completed',
        producedEvidence: [evidenceDigest],
      },
    ],
    evidence: [evidence],
    results: [
      {
        schemaVersion: 1,
        resultId: 'result:res-val-1',
        claimId: 'claim:limit-adequacy',
        runId: 'run:spec-review-1',
        stage: 'validation',
        outcome: 'pass',
        evidenceDigests: [evidenceDigest],
        confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'stated' },
        decidedAt: T2,
      },
    ],
    approvals: [
      {
        schemaVersion: 1,
        approvalId: 'approval:signoff-val-1',
        resultId: 'result:res-val-1',
        approverId: 'actor:chief-engineer-01',
        approverKind: 'person',
        decision: 'approved',
        decidedAt: T3,
      },
    ],
    ...overrides,
  });
}
