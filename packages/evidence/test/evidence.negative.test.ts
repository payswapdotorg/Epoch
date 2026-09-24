// Negative tests: schema violations, version skew, digest mismatches, and
// subject conflicts are all rejected with typed issues (never throws).
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@epoch/agent-protocol';
import {
  computeEvidenceDigest,
  EvidenceStore,
  parseEvidenceRecord,
  verifyArtifactRevision,
  verifyEvidenceRecord,
} from '../src/index';
import {
  ARTIFACT_R3,
  ARTIFACT_R3_DIGEST,
  ARTIFACT_R4,
  ARTIFACT_R4_DIGEST,
  evidenceRecord,
} from './helpers';

describe('evidence record schema (negative: malformed records rejected)', () => {
  it('rejects unknown keys (strict shape)', () => {
    const parsed = parseEvidenceRecord({ ...evidenceRecord(), extra: true });
    expect(parsed.ok).toBe(false);
  });

  it('rejects unknown evidence kinds', () => {
    const parsed = parseEvidenceRecord(evidenceRecord({ kind: 'vibe' }));
    expect(parsed.ok).toBe(false);
  });

  it('rejects malformed SHA-256 subject digests (not 64 lowercase hex)', () => {
    for (const digest of ['deadbeef', 'DEADBEEF'.repeat(8), 'z'.repeat(64), '']) {
      const parsed = parseEvidenceRecord(
        evidenceRecord({ subject: { artifactId: 'a', revision: 'r1', digest } }),
      );
      expect(parsed.ok, `digest "${digest}"`).toBe(false);
    }
  });

  it('rejects non-canonical timestamps', () => {
    for (const observedAt of ['2025-06-01T09:30:00Z', '2025-06-01 09:30:00.000Z', '2025-13-01T09:30:00.000Z', 1750000000000]) {
      const parsed = parseEvidenceRecord(evidenceRecord({ observedAt }));
      expect(parsed.ok, `observedAt ${JSON.stringify(observedAt)}`).toBe(false);
    }
  });

  it('rejects malformed media types', () => {
    const parsed = parseEvidenceRecord(
      evidenceRecord({ content: { mediaType: 'not a media type', data: {} } }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('rejects confidence values outside [0,1] and interval bound inversions', () => {
    expect(
      parseEvidenceRecord(evidenceRecord({ confidence: { distribution: { kind: 'point', value: 1.5 } } })).ok,
    ).toBe(false);
    expect(
      parseEvidenceRecord(
        evidenceRecord({ confidence: { distribution: { kind: 'interval', lower: 0.9, upper: 0.4 } } }),
      ).ok,
    ).toBe(false);
  });

  it('rejects set confidence weights that do not align with values', () => {
    const parsed = parseEvidenceRecord(
      evidenceRecord({
        confidence: { distribution: { kind: 'set', values: [0.2, 0.8], weights: [1] } },
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('rejects empty required strings (artifact, revision, run, actor)', () => {
    expect(parseEvidenceRecord(evidenceRecord({ subject: { artifactId: '', revision: 'r3', digest: ARTIFACT_R3_DIGEST } })).ok).toBe(false);
    expect(
      parseEvidenceRecord(evidenceRecord({ producedBy: { runId: 'run:x', actorId: '' } })).ok,
    ).toBe(false);
  });
});

describe('version discriminator (negative: version skew rejected distinctly)', () => {
  it('rejects schemaVersion 2 with the dedicated version-mismatch code', () => {
    const parsed = parseEvidenceRecord(evidenceRecord({ schemaVersion: 2 }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0]?.code).toBe('version-mismatch');
    expect(parsed.issues[0]?.message).toContain('expected 1');
  });

  it('rejects a missing schemaVersion as a schema issue', () => {
    const bad = evidenceRecord();
    delete bad.schemaVersion;
    const parsed = parseEvidenceRecord(bad);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.every((issue) => issue.code === 'schema')).toBe(true);
  });
});

describe('digest discipline (negative: mismatched digests rejected)', () => {
  it('a record no longer matches its address after content tampering', () => {
    const record = parseEvidenceRecord(evidenceRecord());
    expect(record.ok).toBe(true);
    if (!record.ok) return;
    const digest = computeEvidenceDigest(record.record);
    const tampered = {
      ...record.record,
      content: { ...record.record.content, data: { deflectionMm: 0.1 } },
    };
    expect(computeEvidenceDigest(tampered as never)).not.toBe(digest);
    expect(verifyEvidenceRecord(tampered as never, digest)).toBe(false);
  });

  it('a record claiming a subject digest that the artifact does not produce fails revision verification', () => {
    // Record claims r3's digest, but is actually about r4's content shape.
    const record = parseEvidenceRecord(
      evidenceRecord({
        subject: { artifactId: 'artifact:structural-report', revision: 'r3', digest: sha256Hex('fake') },
      }),
    );
    expect(record.ok).toBe(true);
    if (!record.ok) return;
    expect(verifyArtifactRevision(record.record, ARTIFACT_R3)).toBe(false);
    expect(verifyArtifactRevision(record.record, ARTIFACT_R4)).toBe(false);
  });
});

describe('content-addressed store (negative: contradictions rejected)', () => {
  it('rejects a second record pinning the same revision label to different content', () => {
    const store = EvidenceStore.create();
    expect(store.add(evidenceRecord()).ok).toBe(true);
    const conflicting = store.add(
      evidenceRecord({
        kind: 'observation',
        subject: {
          artifactId: 'artifact:structural-report',
          revision: 'r3',
          digest: ARTIFACT_R4_DIGEST, // different content for the SAME revision label
        },
      }),
    );
    expect(conflicting.ok).toBe(false);
    if (conflicting.ok) return;
    expect(conflicting.issues[0]?.code).toBe('subject-conflict');
    expect(store.size).toBe(1);
  });

  it('digest lookup misses after tampering (a changed record has a new address)', () => {
    const store = EvidenceStore.create();
    const added = store.add(evidenceRecord());
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const tampered = evidenceRecord({ observedAt: '2025-06-02T08:00:00.000Z' });
    const tamperedResult = store.add(tampered);
    expect(tamperedResult.ok).toBe(true);
    if (!tamperedResult.ok) return;
    expect(tamperedResult.receipt.digest).not.toBe(added.receipt.digest);
    // The ORIGINAL content still resolves; the tampered copy resolves to its own address.
    expect(store.byDigest(added.receipt.digest)?.observedAt).toBe('2025-06-01T09:30:00.000Z');
    expect(store.byDigest(tamperedResult.receipt.digest)?.observedAt).toBe('2025-06-02T08:00:00.000Z');
  });
});
