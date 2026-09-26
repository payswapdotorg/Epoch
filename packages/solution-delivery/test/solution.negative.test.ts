// NAMED NEGATIVES (solution baselines): version-conflict on mutation of a
// published baseline; baseline-mutation-rejected on in-place revision of
// an approved baseline; digest-mismatch on tampering and broken chains;
// cross-tenant-denied; dangling world/constraint/evidence references;
// vendor-fields-rejected; validation of malformed content.
import { describe, expect, it } from 'vitest';
import {
  admitSolutionVersion,
  approveSolutionBaseline,
  reviseSolutionBaseline,
  resolveConstraintReferences,
  resolveEvidenceReferences,
  resolveWorldReferences,
  sealSolutionVersion,
  verifySealedSolutionVersion,
  verifySolutionVersionChain,
} from '../src/index';
import {
  CONSTRAINT_ID,
  EVIDENCE_DIGEST,
  OTHER_TENANT,
  sealedV1,
  sealedV2,
  solutionVersionContent,
  baselineApproval,
  WORLD_ENTITY,
} from './fixtures';

describe('NAMED NEGATIVE: mutation of a published baseline (version-conflict)', () => {
  it('re-publishing the same version with different content is rejected', () => {
    const v1 = sealedV1();
    const mutated = sealSolutionVersion(
      solutionVersionContent({ title: 'Tower retrofit solution (mutated)' }),
    );
    expect(mutated.ok).toBe(true);
    if (!mutated.ok) return;
    const admitted = admitSolutionVersion([v1], mutated.value);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('version-conflict');
    }
  });

  it('a non-ascending version is rejected', () => {
    const v1 = sealedV1();
    const v2 = sealedV2(v1);
    const lower = sealSolutionVersion(
      solutionVersionContent({ version: '1.0.1', previousVersionDigest: v2.contentDigest }),
    );
    expect(lower.ok).toBe(true);
    if (!lower.ok) return;
    const admitted = admitSolutionVersion([v1, v2], lower.value);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('version-conflict');
    }
  });

  it('a chain with a duplicate version is rejected', () => {
    const v1 = sealedV1();
    const v1Clone = sealSolutionVersion(solutionVersionContent());
    expect(v1Clone.ok).toBe(true);
    if (!v1Clone.ok) return;
    const chain = verifySolutionVersionChain([v1, v1Clone.value]);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      expect(chain.error.code).toBe('version-conflict');
    }
  });
});

describe('NAMED NEGATIVE: approved baseline revision (baseline-mutation-rejected)', () => {
  it('an in-place edit of an approved baseline is a typed rejection', () => {
    const v1 = sealedV1();
    const approved = approveSolutionBaseline(v1, baselineApproval(v1));
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    const revised = reviseSolutionBaseline(approved.value.approval, {
      title: 'edited title',
    });
    expect(revised.ok).toBe(false);
    if (!revised.ok) {
      expect(revised.error.code).toBe('baseline-mutation-rejected');
      expect(revised.error.message).toContain('immutable');
    }
  });
});

describe('NAMED NEGATIVE: tampered digest (digest-mismatch)', () => {
  it('a sealed version with a tampered content digest is rejected', () => {
    const v1 = sealedV1();
    const tampered = { ...v1, title: 'tampered title' };
    const verified = verifySealedSolutionVersion(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a chain with a broken link is rejected', () => {
    const v1 = sealedV1();
    const v2 = sealedV2(v1);
    const broken = { ...v2, previousVersionDigest: 'c'.repeat(64) };
    const chain = verifySolutionVersionChain([v1, broken]);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      expect(chain.error.code).toBe('digest-mismatch');
    }
  });

  it('an admission that does not link to the head digest is rejected', () => {
    const v1 = sealedV1();
    const v2 = sealedV2(v1);
    const orphan = sealSolutionVersion(
      solutionVersionContent({
        version: '2.0.0',
        previousVersionDigest: 'd'.repeat(64),
      }),
    );
    expect(orphan.ok).toBe(true);
    if (!orphan.ok) return;
    const admitted = admitSolutionVersion([v1, v2], orphan.value);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('digest-mismatch');
    }
  });
});

describe('NAMED NEGATIVE: cross-tenant approval (cross-tenant-denied)', () => {
  it('a baseline approval from another tenant is rejected', () => {
    const v1 = sealedV1();
    const approval = baselineApproval(v1);
    const foreign = { ...approval, tenantId: OTHER_TENANT };
    const approved = approveSolutionBaseline(v1, foreign);
    expect(approved.ok).toBe(false);
    if (!approved.ok) {
      expect(approved.error.code).toBe('cross-tenant-denied');
    }
  });
});

describe('NAMED NEGATIVE: dangling references (dangling-reference-rejected)', () => {
  it('an unknown world entity reference is rejected', () => {
    const resolved = resolveWorldReferences([{ entityId: 'missing-entity' }], {
      hasEntity: (entityId: string) => entityId === WORLD_ENTITY,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe('dangling-reference-rejected');
      if (resolved.error.code === 'dangling-reference-rejected') {
        expect(resolved.error.referenceKind).toBe('world-entity');
      }
    }
  });

  it('an unknown constraint reference is rejected', () => {
    const resolved = resolveConstraintReferences([{ constraintId: 'missing-constraint' }], {
      hasConstraint: (id: string) => id === CONSTRAINT_ID,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe('dangling-reference-rejected');
      if (resolved.error.code === 'dangling-reference-rejected') {
        expect(resolved.error.referenceKind).toBe('constraint');
      }
    }
  });

  it('an unknown evidence digest is rejected', () => {
    const resolved = resolveEvidenceReferences([{ digest: 'e'.repeat(64) }], {
      hasEvidence: (digest: string) => digest === EVIDENCE_DIGEST,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe('dangling-reference-rejected');
      if (resolved.error.code === 'dangling-reference-rejected') {
        expect(resolved.error.referenceKind).toBe('evidence');
      }
    }
  });
});

describe('NAMED NEGATIVE: vendor fields (vendor-fields-rejected)', () => {
  it('unknown structural fields are rejected on the content schema', () => {
    const sealed = sealSolutionVersion({
      ...solutionVersionContent(),
      aurumProjectId: 'proj-123',
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('vendor-fields-rejected');
    }
  });
});

describe('NAMED NEGATIVE: malformed content (validation)', () => {
  it('schemaVersion skew reports at the precise path', () => {
    const sealed = sealSolutionVersion({
      ...solutionVersionContent(),
      schemaVersion: 2,
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
      if (sealed.error.code === 'validation') {
        expect(sealed.error.issues.some((issue) => issue.path === 'schemaVersion')).toBe(true);
      }
    }
  });

  it('unsorted solution lines are rejected (deterministic serialization)', () => {
    const content = solutionVersionContent() as { solutionLines: unknown[] };
    const unsorted = [...content.solutionLines].reverse();
    const sealed = sealSolutionVersion({ ...solutionVersionContent(), solutionLines: unsorted });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });
});
