// RUNTIME PARITY with the sibling kernel vocabularies (the W036/W037/
// W038/W039-actualization kernel-parity pattern; devDependencies only —
// no runtime coupling):
//
// - W036 solution-delivery: the measure-value MIRROR fixtures validate
//   through the REAL W036 MeasureSchema; the confidence mirror validates
//   through the REAL W036 ConfidenceStateSchema; the compared-line id
//   grammars are pattern-identical to the W036 distinction id grammar;
// - W037 procurement: the commitment compared-line grammar matches the
//   REAL W037 CommitmentReference grammar;
// - W038 execution-tracking: the issue-record cause references match the
//   REAL W038 issue-id grammar;
// - W010 event-log: the principal grammar is pattern-identical (the W009
//   grammar);
// - W006 evidence: real evidence digests are admitted by the
//   evidence-digest grammar (variance evidence references are
//   exact-revision addressable).
import { describe, expect, it } from 'vitest';
import { sealEvent, EVENT_ACTOR_PATTERN } from '@epoch/event-log';
import {
  computeEvidenceDigest,
  EvidenceRecordSchema,
  CONFIDENCE_METHODS as EVIDENCE_CONFIDENCE_METHODS,
} from '@epoch/evidence';
import {
  ISSUE_ID_PATTERNS,
  CONFIDENCE_METHODS as EXECUTION_CONFIDENCE_METHODS,
} from '@epoch/execution-tracking';
import {
  CommitmentReferenceSchema,
  ObservationReferenceSchema,
} from '@epoch/procurement';
import {
  ConfidenceStateSchema,
  MeasureSchema,
  DistinctionRecordIdSchema,
} from '@epoch/solution-delivery';
import {
  VARIANCE_PRINCIPAL_ID_PATTERN,
  PrincipalIdSchema,
  Sha256HexSchema,
  ComparedLineRefSchema,
  VarianceConfidenceSchema,
  AttributionCauseRefSchema,
} from '../src/index';
import { unwrap } from './helpers';
import { EVIDENCE_DIGEST, PRINCIPAL, TENANT, T1, confidence, varianceInput } from './fixtures';

describe('W036 solution-delivery parity (runtime)', () => {
  it('the measure-value MIRROR fixtures validate through the REAL W036 MeasureSchema', () => {
    const measures = [
      { kind: 'quantity', value: '118.5', unit: 'm3' },
      { kind: 'cost', amount: '1107.75', currency: 'EUR' },
      { kind: 'instant', at: '2026-04-06T08:00:03.000Z' },
      { kind: 'progress', fraction: 0.6 },
    ];
    for (const measure of measures) {
      expect(MeasureSchema.safeParse(measure).success, JSON.stringify(measure)).toBe(true);
    }
    // A malformed mirror value fails the REAL W036 schema too.
    expect(MeasureSchema.safeParse({ kind: 'quantity', value: '-1', unit: 'm3' }).success).toBe(false);
  });

  it('the confidence MIRROR validates through the REAL W036 ConfidenceStateSchema', () => {
    const parsed = ConfidenceStateSchema.safeParse(confidence());
    expect(parsed.success).toBe(true);
    expect(VarianceConfidenceSchema.safeParse(confidence()).success).toBe(true);
  });

  it('the compared-line record-id grammars are the W036 distinction id grammar', () => {
    for (const [kind, recordId] of [
      ['prediction', 'prediction:pit-volume'],
      ['baseline', 'baseline:pit-volume-v1'],
      ['commitment', 'commitment:pit-volume-supplier'],
      ['forecast', 'forecast:pit-volume-r1'],
      ['actual', 'actual:pit-volume-monday'],
    ] as const) {
      expect(DistinctionRecordIdSchema.safeParse(recordId).success).toBe(true);
      expect(
        ComparedLineRefSchema.safeParse({ kind, recordId, contentDigest: EVIDENCE_DIGEST }).success,
      ).toBe(true);
    }
    expect(ComparedLineRefSchema.safeParse({ kind: 'actual', recordId: 'rogue', contentDigest: EVIDENCE_DIGEST }).success).toBe(false);
  });
});

describe('W037 procurement parity (runtime)', () => {
  it('the commitment compared-line grammar matches the REAL W037 CommitmentReference', () => {
    const reference = { recordId: 'commitment:pit-volume-supplier', contentDigest: EVIDENCE_DIGEST };
    expect(CommitmentReferenceSchema.safeParse(reference).success).toBe(true);
    const compared = ComparedLineRefSchema.safeParse({
      kind: 'commitment',
      ...reference,
    });
    expect(compared.success).toBe(true);
  });

  it('the digest grammar matches the REAL W037 ObservationReference digest grammar', () => {
    // The REAL W037 reference validates with the same digest grammar.
    expect(
      ObservationReferenceSchema.safeParse({
        recordId: 'observation:pit-volume-monday',
        contentDigest: EVIDENCE_DIGEST,
      }).success,
    ).toBe(true);
    expect(Sha256HexSchema.safeParse(EVIDENCE_DIGEST).success).toBe(true);
    expect(Sha256HexSchema.safeParse('XYZ').success).toBe(false);
  });
});

describe('W038 execution-tracking parity (runtime)', () => {
  it('the issue-record cause references match the REAL W038 issue-id grammar', () => {
    for (const kind of ['change', 'delay', 'rework', 'defect', 'blocker'] as const) {
      const recordId = `${kind}:steel-delivery`;
      expect(new RegExp(ISSUE_ID_PATTERNS[kind]).test(recordId)).toBe(true);
      expect(
        AttributionCauseRefSchema.safeParse({
          causeKind: 'issue-record',
          recordId,
          contentDigest: EVIDENCE_DIGEST,
        }).success,
      ).toBe(true);
    }
    expect(
      AttributionCauseRefSchema.safeParse({
        causeKind: 'issue-record',
        recordId: 'not-an-issue',
        contentDigest: EVIDENCE_DIGEST,
      }).success,
    ).toBe(false);
  });

  it('the confidence-method vocabulary is member-identical (evidence-shaped)', () => {
    expect([...EXECUTION_CONFIDENCE_METHODS]).toEqual([...EVIDENCE_CONFIDENCE_METHODS]);
  });
});

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored principal grammar is exactly the W010 actor pattern (the W009 grammar)', () => {
    expect(VARIANCE_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(VARIANCE_PRINCIPAL_ID_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
    expect(PrincipalIdSchema.safeParse(PRINCIPAL).success).toBe(true);
    expect(PrincipalIdSchema.safeParse('principal:').success).toBe(false);
  });

  it('the variance computation output is JSON-representable W010 payload data', () => {
    // Variance records serialize into event payloads (the service emits
    // actualization:* events carrying them) — pin the JSON round trip.
    const record = JSON.parse(
      JSON.stringify({ ...varianceInput(), evidence: [EVIDENCE_DIGEST] }),
    ) as Record<string, unknown>;
    const sealed = unwrap(sealEvent({
      schemaVersion: 1,
      streamId: 'stream:actualization-tower-retrofit-v1',
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: { discriminator: 'actualization:variance-recorded', data: record },
      occurredAt: T1,
    }));
    expect(sealed.digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('W006 evidence parity (runtime)', () => {
  it('real evidence digests are admitted by the evidence-digest grammar', () => {
    const evidence = {
      schemaVersion: 1,
      kind: 'measurement',
      subject: { artifactId: 'engineering.pit-volume', revision: '1.0.0', digest: '0'.repeat(64) },
      producedBy: {
        runId: 'run:site-2026-04-06',
        actorId: PRINCIPAL,
        methodId: 'method:site-measurement',
      },
      observedAt: T1,
      content: { mediaType: 'application/json', data: { volume: '118.5' } },
      confidence: { distribution: { kind: 'point', value: 0.92 }, method: 'measured' },
    };
    const parsed = EvidenceRecordSchema.safeParse(evidence);
    expect(parsed.success, JSON.stringify(parsed.error ?? 'ok')).toBe(true);
    const digest = computeEvidenceDigest(evidence as never);
    expect(Sha256HexSchema.safeParse(digest).success).toBe(true);
  });
});
