// POSITIVE: baseline round-trip serialization, hash-chain verification,
// idempotent admission, baseline approval, and dangling-reference
// resolution over world/constraint/evidence lookups.
import { describe, expect, it } from 'vitest';
import {
  admitSolutionVersion,
  approveSolutionBaseline,
  resolveConstraintReferences,
  resolveEvidenceReferences,
  resolveWorldReferences,
  sealSolutionVersion,
  verifySealedSolutionVersion,
  verifySolutionVersionChain,
} from '../src/index';
import {
  APPROVER,
  CONSTRAINT_ID,
  CONSTRAINT_ID_2,
  EVIDENCE_DIGEST,
  OTHER_TENANT,
  sealedV1,
  sealedV2,
  solutionVersionContent,
  TENANT,
  baselineApproval,
  WORLD_ENTITY,
  WORLD_ENTITY_2,
} from './fixtures';

describe('solution version baseline round-trip', () => {
  it('seals valid content into a digest-bearing envelope', () => {
    const sealed = sealSolutionVersion(solutionVersionContent());
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(sealed.value.solutionId).toBe('solution:tower-retrofit');
      expect(sealed.value.version).toBe('1.0.0');
    }
  });

  it('round-trips through JSON serialization with digest verification', () => {
    const sealed = sealedV1();
    const roundTripped = JSON.parse(JSON.stringify(sealed)) as unknown;
    const verified = verifySealedSolutionVersion(roundTripped);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(sealed);
    }
  });

  it('semantically equal content digests stably regardless of key order', () => {
    const content = solutionVersionContent() as Record<string, unknown>;
    // Shuffle OBJECT key order only (arrays keep their canonical order —
    // they are semantically ordered):
    const reordered: Record<string, unknown> = {
      createdBy: content['createdBy'],
      createdAt: content['createdAt'],
      constraintReferences: content['constraintReferences'],
      worldReferences: content['worldReferences'],
      solutionLines: content['solutionLines'],
      tenantId: content['tenantId'],
      version: content['version'],
      solutionId: content['solutionId'],
      schemaVersion: content['schemaVersion'],
      schema: content['schema'],
      previousVersionDigest: content['previousVersionDigest'],
      title: content['title'],
      objective: content['objective'],
      description: content['description'],
    };
    const a = sealSolutionVersion(solutionVersionContent());
    const b = sealSolutionVersion(reordered);
    expect(a.ok && b.ok && a.value.contentDigest === b.value.contentDigest).toBe(true);
  });
});

describe('solution version chain verification', () => {
  it('verifies the v1 -> v2 hash chain with a summary', () => {
    const v1 = sealedV1();
    const v2 = sealedV2(v1);
    const chain = verifySolutionVersionChain([v1, v2]);
    expect(chain.ok).toBe(true);
    if (chain.ok) {
      expect(chain.value.solutionId).toBe('solution:tower-retrofit');
      expect(chain.value.versionCount).toBe(2);
      expect(chain.value.headVersion).toBe('1.1.0');
      expect(chain.value.headDigest).toBe(v2.contentDigest);
    }
  });

  it('chain verification is order-independent (input order never leaks)', () => {
    const v1 = sealedV1();
    const v2 = sealedV2(v1);
    const forward = verifySolutionVersionChain([v1, v2]);
    const backward = verifySolutionVersionChain([v2, v1]);
    expect(forward.ok && backward.ok).toBe(true);
    if (forward.ok && backward.ok) {
      expect(forward.value).toEqual(backward.value);
    }
  });

  it('admits an ascending chain-linked version (append semantics)', () => {
    const v1 = sealedV1();
    const v2 = sealedV2(v1);
    const admitted = admitSolutionVersion([v1], v2);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value).toHaveLength(2);
    }
  });

  it('re-admitting the exact same version is idempotent', () => {
    const v1 = sealedV1();
    const admitted = admitSolutionVersion([v1], v1);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value).toHaveLength(1);
    }
  });
});

describe('baseline approval', () => {
  it('approves a sealed version as the baseline (distinct authority act)', () => {
    const v1 = sealedV1();
    const approval = baselineApproval(v1);
    const approved = approveSolutionBaseline(v1, approval);
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(approved.value.approval.baselineDigest).toBe(v1.contentDigest);
      expect(approved.value.approval.approvedBy).toBe(APPROVER);
    }
  });
});

describe('reference resolution (world / constraint / evidence)', () => {
  it('resolves world references against a world-shaped lookup', () => {
    const lookup = {
      hasEntity: (entityId: string) => entityId === WORLD_ENTITY || entityId === WORLD_ENTITY_2,
    };
    const resolved = resolveWorldReferences(
      [
        { entityId: WORLD_ENTITY },
        { entityId: WORLD_ENTITY_2 },
      ],
      lookup,
    );
    expect(resolved.ok).toBe(true);
  });

  it('resolves constraint references against a constraint-shaped lookup', () => {
    const lookup = { hasConstraint: (id: string) => id === CONSTRAINT_ID || id === CONSTRAINT_ID_2 };
    const resolved = resolveConstraintReferences(
      [
        { constraintId: CONSTRAINT_ID },
        { constraintId: CONSTRAINT_ID_2 },
      ],
      lookup,
    );
    expect(resolved.ok).toBe(true);
  });

  it('resolves evidence references against an evidence-shaped lookup', () => {
    const lookup = { hasEvidence: (digest: string) => digest === EVIDENCE_DIGEST };
    const resolved = resolveEvidenceReferences([{ digest: EVIDENCE_DIGEST }], lookup);
    expect(resolved.ok).toBe(true);
  });

  it('accepts an empty reference list trivially', () => {
    expect(resolveWorldReferences([], { hasEntity: () => false }).ok).toBe(true);
    expect(resolveConstraintReferences([], { hasConstraint: () => false }).ok).toBe(true);
    expect(resolveEvidenceReferences([], { hasEvidence: () => false }).ok).toBe(true);
  });
});

describe('tenant scoping', () => {
  it('carries the tenant scope on every sealed version', () => {
    expect(sealedV1().tenantId).toBe(TENANT);
    expect(OTHER_TENANT).not.toBe(TENANT);
  });
});
