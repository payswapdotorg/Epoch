// Store-level evidence: canonical-record admission across ALL FOUR
// object classes (real W036 pipelines), the solution-version chain
// rule, tenant isolation on every admission path, and the derived
// state projection.
import { describe, expect, it } from 'vitest';
import { sealSolutionVersion } from '@epoch/solution-delivery';
import {
  admitCanonicalRecord,
  admitProjectionPolicy,
  appendAuditRecord,
  auditRecordIdOf,
  canonicalObjectIdentity,
  deriveEvaluationKey,
  findCanonicalRecord,
  findPolicyRevision,
  kernelAuditProvenance,
  openAccessProjectionStore,
  projectAccessState,
  sealProjectionAudit,
  sealProjectionPolicy,
} from '../src/index';
import { unwrap, expectError, withoutDigest } from './helpers';
import {
  COMMITMENT_ID,
  DELIVERY_ID,
  OBSERVATION_ID,
  PROGRAM_ID,
  SOLUTION_ID,
  TENANT,
  OTHER_TENANT,
  sealedCommitment,
  sealedDelivery,
  sealedProgram,
  sealedSolutionVersion,
  standardPolicyContent,
} from './fixtures';

describe('canonical record admission (all four object classes)', () => {
  it('admits a REAL sealed program of work', () => {
    const store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const admission = unwrap(
      admitCanonicalRecord(store, { objectClass: 'program-of-work', record: sealedProgram() }),
    );
    expect(admission.outcome.kind).toBe('record-admitted');
    expect(admission.outcome.record.objectClass).toBe('program-of-work');
  });

  it('admits a REAL sealed delivery record', () => {
    const store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const admission = unwrap(
      admitCanonicalRecord(store, { objectClass: 'delivery-record', record: sealedDelivery() }),
    );
    expect(admission.outcome.kind).toBe('record-admitted');
    expect(admission.outcome.record.objectClass).toBe('delivery-record');
  });

  it('admits a REAL sealed solution version and its chain revisions', () => {
    const store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const v1 = sealedSolutionVersion();
    const first = unwrap(admitCanonicalRecord(store, { objectClass: 'solution-version', record: v1 }));
    expect(first.outcome.kind).toBe('record-admitted');

    // A SECOND chain revision under the same solution id (a new
    // version, a new digest) is admitted — the version chain is
    // multi-revision by design.
    const v1Content = withoutDigest(v1);
    const v2 = unwrap(sealSolutionVersion({ ...v1Content, version: '1.1.0' }));
    const second = unwrap(
      admitCanonicalRecord(first.store, { objectClass: 'solution-version', record: v2 }),
    );
    expect(second.outcome.kind).toBe('record-admitted');
    expect(second.store.records).toHaveLength(2);

    // The SAME version with different content is a version-conflict
    // (the chain never rewrites a published revision).
    const v1Prime = unwrap(
      sealSolutionVersion({ ...v1Content, title: 'A divergent title' }),
    );
    expectError(
      admitCanonicalRecord(second.store, { objectClass: 'solution-version', record: v1Prime }),
      'version-conflict',
    );
  });
});

describe('lookup helpers', () => {
  it('finds admitted records and policy revisions by exact reference', () => {
    let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const canonical = { objectClass: 'program-of-work' as const, record: sealedProgram() };
    store = unwrap(admitCanonicalRecord(store, canonical)).store;
    const identity = canonicalObjectIdentity(canonical);
    expect(findCanonicalRecord(store, identity.objectClass, identity.objectId, identity.objectDigest)).not.toBeNull();
    expect(
      findCanonicalRecord(store, identity.objectClass, identity.objectId, 'f'.repeat(64)),
    ).toBeNull();

    const policy = unwrap(sealProjectionPolicy(standardPolicyContent()));
    store = unwrap(admitProjectionPolicy(store, policy)).store;
    expect(findPolicyRevision(store, policy.policyId, 1)?.contentDigest).toBe(policy.contentDigest);
    expect(findPolicyRevision(store, policy.policyId, 2)).toBeNull();
  });
});

describe('tenant isolation on every admission path', () => {
  it('a cross-tenant canonical record is tenant-isolation-rejected', () => {
    const store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    // A REAL, VALID sealed program of the OTHER tenant (never a broken
    // digest — the tenant gate itself must fire).
    const foreign = sealedProgram(OTHER_TENANT);
    const error = expectError(
      admitCanonicalRecord(store, {
        objectClass: 'program-of-work',
        record: foreign,
      }),
      'tenant-isolation-rejected',
    );
    if (error.code === 'tenant-isolation-rejected') {
      expect(error.encounteredTenantId).toBe(OTHER_TENANT);
    }
  });

  it('a cross-tenant audit record is tenant-isolation-rejected', () => {
    const store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const evaluationKey = deriveEvaluationKey({
      tenantId: OTHER_TENANT,
      principalId: 'principal:x',
      action: 'view',
      policyDigest: 'a'.repeat(64),
      objectClass: 'program-of-work',
      objectId: PROGRAM_ID,
      objectDigest: 'b'.repeat(64),
      decisionDigest: 'c'.repeat(64),
      projectedAt: '2026-04-01T09:00:00.000Z',
    });
    const audit = unwrap(
      sealProjectionAudit({
        schema: 'epoch.access-projection.audit',
        schemaVersion: 1,
        auditId: auditRecordIdOf(evaluationKey),
        tenantId: OTHER_TENANT,
        principalId: 'principal:x',
        subject: { principalId: 'principal:x', principalKind: 'human', role: 'role:r' },
        policyRef: { policyId: 'policy:p', revision: 1, policyDigest: 'a'.repeat(64) },
        objectClass: 'program-of-work',
        objectId: PROGRAM_ID,
        objectDigest: 'b'.repeat(64),
        decisionDigest: 'c'.repeat(64),
        action: 'view',
        outcome: 'released',
        fieldsReleased: [],
        fieldsRedacted: [],
        appliedScopes: {
          evidenceMode: 'none',
          allowedEvidenceCount: 0,
          commercial: 'hidden',
          supplier: 'hidden',
        },
        evaluationKey,
        provenance: kernelAuditProvenance(undefined),
        projectedAt: '2026-04-01T09:00:00.000Z',
      }),
    );
    expectError(appendAuditRecord(store, audit), 'tenant-isolation-rejected');
  });
});

describe('the derived projection-state projection', () => {
  it('counts records by class across the four families', () => {
    let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    store = unwrap(
      admitCanonicalRecord(store, { objectClass: 'program-of-work', record: sealedProgram() }),
    ).store;
    store = unwrap(
      admitCanonicalRecord(store, { objectClass: 'delivery-record', record: sealedDelivery() }),
    ).store;
    store = unwrap(
      admitCanonicalRecord(store, { objectClass: 'solution-version', record: sealedSolutionVersion() }),
    ).store;
    store = unwrap(
      admitCanonicalRecord(store, { objectClass: 'distinction-record', record: sealedCommitment() }),
    ).store;
    const state = projectAccessState(store);
    expect(state.recordCount).toBe(4);
    expect(state.recordsByClass).toEqual([
      { objectClass: 'delivery-record', count: 1 },
      { objectClass: 'distinction-record', count: 1 },
      { objectClass: 'program-of-work', count: 1 },
      { objectClass: 'solution-version', count: 1 },
    ]);
    expect(state.tenantId).toBe(TENANT);
  });
});

describe('opaque id discipline (fixture identities are the W036 grammars)', () => {
  it('the fixture records carry the canonical id grammars', () => {
    expect(PROGRAM_ID).toMatch(/^program:[a-z0-9][a-z0-9-]{0,62}$/);
    expect(DELIVERY_ID).toMatch(/^delivery:[a-z0-9][a-z0-9-]{0,62}$/);
    expect(OBSERVATION_ID).toMatch(/^observation:[a-z0-9][a-z0-9-]{0,62}$/);
    expect(COMMITMENT_ID).toMatch(/^commitment:[a-z0-9][a-z0-9-]{0,62}$/);
    expect(SOLUTION_ID).toMatch(/^solution:[a-z0-9][a-z0-9-]{0,62}$/);
  });
});
