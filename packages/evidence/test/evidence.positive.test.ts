// Positive tests: valid records, deterministic content-addressed digests,
// exact-revision artifact lookup, digest/subject verification, and the
// version discriminator behavior.
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  computeEvidenceDigest,
  EvidenceStore,
  EvidenceVersionSchema,
  parseEvidenceRecord,
  verifyArtifactRevision,
  verifyEvidenceRecord,
} from '../src/index';
import {
  ARTIFACT_R3,
  ARTIFACT_R3_DIGEST,
  ARTIFACT_R4,
  ARTIFACT_R4_DIGEST,
  CERTAIN,
  evidenceRecord,
  T0,
  T1,
} from './helpers';

describe('evidence record schema (positive)', () => {
  it('accepts a valid measurement record', () => {
    const parsed = parseEvidenceRecord(evidenceRecord());
    expect(parsed.ok).toBe(true);
  });

  it('accepts every evidence kind in the W002-aligned vocabulary', () => {
    for (const kind of [
      'document',
      'measurement',
      'observation',
      'computation',
      'assertion',
      'external',
      'other',
    ]) {
      const parsed = parseEvidenceRecord(evidenceRecord({ kind }));
      expect(parsed.ok, `kind ${kind}`).toBe(true);
    }
  });

  it('accepts an optional out-of-band locator and absent methodId', () => {
    const parsed = parseEvidenceRecord(
      evidenceRecord({
        producedBy: { runId: 'run:x', actorId: 'actor:y' },
        content: {
          mediaType: 'application/json',
          data: { note: 'see locator' },
          locator: 'urn:epoch-artifact:example:1',
        },
      }),
    );
    expect(parsed.ok).toBe(true);
  });

  it('accepts all three confidence distribution shapes', () => {
    expect(parseEvidenceRecord(evidenceRecord({ confidence: CERTAIN })).ok).toBe(true);
    expect(
      parseEvidenceRecord(
        evidenceRecord({
          confidence: { distribution: { kind: 'set', values: [0.2, 0.8], weights: [1, 3] } },
        }),
      ).ok,
    ).toBe(true);
    expect(
      parseEvidenceRecord(evidenceRecord({ confidence: { distribution: { kind: 'point', value: 0.5 } } })).ok,
    ).toBe(true);
  });
});

describe('content-addressed digest discipline (positive)', () => {
  it('digests a record to the SHA-256 of its canonical JSON form', () => {
    const record = parseEvidenceRecord(evidenceRecord());
    expect(record.ok).toBe(true);
    if (!record.ok) return;
    const digest = computeEvidenceDigest(record.record);
    expect(digest).toBe(canonicalDigest(record.record as never));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is key-order insensitive: reordered records share one address', () => {
    const a = parseEvidenceRecord(evidenceRecord());
    const reordered = {
      confidence: {
        rationale: 'sensor calibration ±0.02mm',
        method: 'measured',
        distribution: { bias: 'none', upper: 0.98, lower: 0.9, kind: 'interval' },
      },
      content: { data: { withinLimit: true, deflectionMm: 4.2 }, mediaType: 'application/json' },
      observedAt: T1,
      producedBy: { methodId: 'method:deflection-check', actorId: 'actor:solver-01', runId: 'run:stress-check-1' },
      subject: { digest: ARTIFACT_R3_DIGEST, revision: 'r3', artifactId: 'artifact:structural-report' },
      kind: 'measurement',
      schemaVersion: 1,
    };
    const b = parseEvidenceRecord(reordered);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(computeEvidenceDigest(a.record)).toBe(computeEvidenceDigest(b.record));
  });

  it('verifies a record against its own digest and detects tampering', () => {
    const record = parseEvidenceRecord(evidenceRecord());
    expect(record.ok).toBe(true);
    if (!record.ok) return;
    const digest = computeEvidenceDigest(record.record);
    expect(verifyEvidenceRecord(record.record, digest)).toBe(true);
    const tampered = { ...record.record, observedAt: T0 };
    expect(verifyEvidenceRecord(tampered as never, digest)).toBe(false);
  });

  it('verifies the exact artifact revision discipline against artifact content', () => {
    const record = parseEvidenceRecord(evidenceRecord());
    expect(record.ok).toBe(true);
    if (!record.ok) return;
    expect(verifyArtifactRevision(record.record, ARTIFACT_R3)).toBe(true);
    expect(verifyArtifactRevision(record.record, ARTIFACT_R4)).toBe(false);
  });
});

describe('content-addressed store (positive)', () => {
  it('stores a record under its canonical digest and finds it by digest', () => {
    const store = EvidenceStore.create();
    const added = store.add(evidenceRecord());
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const found = store.byDigest(added.receipt.digest);
    expect(found).toBeDefined();
    expect(found?.subject.revision).toBe('r3');
    expect(store.has(added.receipt.digest)).toBe(true);
    expect(store.size).toBe(1);
  });

  it('looks evidence up by exact artifact revision (content-addressed)', () => {
    const store = EvidenceStore.create();
    const r3 = store.add(evidenceRecord());
    const r4 = store.add(
      evidenceRecord({
        subject: { artifactId: 'artifact:structural-report', revision: 'r4', digest: ARTIFACT_R4_DIGEST },
        content: { mediaType: 'application/json', data: { deflectionMm: 3.9 } },
      }),
    );
    expect(r3.ok && r4.ok).toBe(true);
    expect(store.byArtifact('artifact:structural-report')).toHaveLength(2);
    const exact = store.byArtifact('artifact:structural-report', {
      revisionDigest: ARTIFACT_R3_DIGEST,
    });
    expect(exact).toHaveLength(1);
    expect(exact[0]?.digest).toBe(r3.ok ? r3.receipt.digest : '');
    expect(store.byArtifact('artifact:structural-report', { revision: 'r4' })).toHaveLength(1);
    expect(store.byArtifact('artifact:unknown')).toHaveLength(0);
  });

  it('allows several records about the same exact revision and is idempotent', () => {
    const store = EvidenceStore.create();
    const first = store.add(evidenceRecord());
    const again = store.add(evidenceRecord());
    expect(first.ok && again.ok).toBe(true);
    expect(store.size).toBe(1);
    const secondObservation = store.add(
      evidenceRecord({
        kind: 'assertion',
        producedBy: { runId: 'run:review-2', actorId: 'actor:reviewer-01' },
        confidence: { distribution: { kind: 'point', value: 0.95 }, method: 'stated' },
      }),
    );
    expect(secondObservation.ok).toBe(true);
    expect(store.size).toBe(2);
    expect(store.byArtifact('artifact:structural-report', { revisionDigest: ARTIFACT_R3_DIGEST })).toHaveLength(2);
  });

  it('reports typed issues instead of throwing on invalid input', () => {
    const store = EvidenceStore.create();
    const result = store.add({ nonsense: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
    expect(store.size).toBe(0);
  });
});

describe('version discriminator (positive)', () => {
  it('admits the current record version literal', () => {
    expect(EvidenceVersionSchema.safeParse(1).success).toBe(true);
    expect(parseEvidenceRecord(evidenceRecord()).ok).toBe(true);
  });
});
