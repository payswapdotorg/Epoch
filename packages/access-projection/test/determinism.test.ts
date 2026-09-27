// Determinism evidence (the W041 dispatch pin: "determinism + replay
// (identical inputs -> identical digests; duplicate evaluation = sealed
// prior audit record)"): the same policy/record/decision/subject/
// instant always produce byte-identical sealed records; store snapshots
// are insertion-order-independent (sorted); contract emission is
// deterministic.
import { describe, expect, it } from 'vitest';
import {
  admitCanonicalRecord,
  admitProjection,
  admitProjectionPolicy,
  appendAuditRecord,
  evaluateProjection,
  openAccessProjectionStore,
  projectAccessState,
  renderAccessProjectionContractFiles,
  sealProjectionPolicy,
} from '../src/index';
import { unwrap, accessRequest, allowContext, sealedDecision } from './helpers';
import {
  CLIENT,
  ENGINEER,
  HOST,
  PROGRAM_ID,
  ROLE_CLIENT,
  ROLE_ENGINEER,
  TENANT,
  T3,
  T4,
  sealedProgram,
  standardPolicyContent,
} from './fixtures';

const PROGRAM = sealedProgram();
const CANONICAL = { objectClass: 'program-of-work' as const, record: PROGRAM };

function evaluateFor(principalId: string, role: string, projectedAt: string) {
  const request = accessRequest(principalId, 'view', {
    resourceType: 'program-of-work',
    resourceId: PROGRAM_ID,
    tenantId: TENANT,
  });
  return unwrap(
    evaluateProjection({
      request,
      decision: sealedDecision(request, allowContext(principalId)),
      policy: unwrap(sealProjectionPolicy(standardPolicyContent())),
      record: CANONICAL,
      subject: { principalId, principalKind: 'human' as const, role },
      projectedAt,
      projectedBy: HOST,
    }),
  );
}

describe('identical inputs -> identical digests', () => {
  it('the same evaluation run twice yields byte-identical sealed records', () => {
    for (const [principalId, role] of [
      [CLIENT, ROLE_CLIENT],
      [ENGINEER, ROLE_ENGINEER],
    ] as const) {
      const first = evaluateFor(principalId, role, T3);
      const second = evaluateFor(principalId, role, T3);
      if (first.outcome !== 'released' || second.outcome !== 'released') {
        throw new Error('expected released');
      }
      expect(first.projection.contentDigest).toBe(second.projection.contentDigest);
      expect(first.audit.contentDigest).toBe(second.audit.contentDigest);
      expect(JSON.stringify(first.projection)).toBe(JSON.stringify(second.projection));
      expect(JSON.stringify(first.audit)).toBe(JSON.stringify(second.audit));
    }
  });

  it('two INDEPENDENT policy sealings of one content yield the same digest', () => {
    const a = unwrap(sealProjectionPolicy(standardPolicyContent()));
    const b = unwrap(sealProjectionPolicy(standardPolicyContent()));
    expect(a.contentDigest).toBe(b.contentDigest);
  });
});

describe('duplicate evaluation = the sealed prior audit record (replay)', () => {
  it('a full store pipeline replay returns the prior records with unchanged state', () => {
    let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const policy = unwrap(sealProjectionPolicy(standardPolicyContent()));
    store = unwrap(admitProjectionPolicy(store, policy)).store;
    store = unwrap(admitCanonicalRecord(store, CANONICAL)).store;

    const first = evaluateFor(CLIENT, ROLE_CLIENT, T3);
    if (first.outcome !== 'released') throw new Error('expected released');
    const firstAudit = unwrap(appendAuditRecord(store, first.audit));
    store = firstAudit.store;
    const firstProjection = unwrap(admitProjection(store, first.projection));
    store = firstProjection.store;
    expect(firstAudit.outcome.kind).toBe('audit-appended');
    expect(firstProjection.outcome.kind).toBe('projection-admitted');

    // The REPLAY: identical evaluation, identical digests.
    const replay = evaluateFor(CLIENT, ROLE_CLIENT, T3);
    if (replay.outcome !== 'released') throw new Error('expected released');
    expect(replay.audit.contentDigest).toBe(first.audit.contentDigest);
    const replayAudit = unwrap(appendAuditRecord(store, replay.audit));
    const replayProjection = unwrap(admitProjection(replayAudit.store, replay.projection));
    expect(replayAudit.outcome.kind).toBe('duplicate-audit-returned');
    expect(replayProjection.outcome.kind).toBe('duplicate-projection-returned');
    expect(replayProjection.store.projections).toHaveLength(1);
    expect(replayProjection.store.audits).toHaveLength(1);
  });

  it('a DIFFERENT instant is a fresh (non-conflicting) audit entry', () => {
    let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const atT3 = evaluateFor(CLIENT, ROLE_CLIENT, T3);
    const atT4 = evaluateFor(CLIENT, ROLE_CLIENT, T4);
    if (atT3.outcome !== 'released' || atT4.outcome !== 'released') {
      throw new Error('expected released');
    }
    store = unwrap(appendAuditRecord(store, atT3.audit)).store;
    const second = unwrap(appendAuditRecord(store, atT4.audit));
    expect(second.outcome.kind).toBe('audit-appended');
    expect(second.store.audits).toHaveLength(2);
  });
});

describe('store snapshots are insertion-order-independent', () => {
  it('admitting the same records in a different order yields identical state projections', () => {
    const policy = unwrap(sealProjectionPolicy(standardPolicyContent()));
    function build(): ReturnType<typeof projectAccessState> {
      let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
      store = unwrap(admitCanonicalRecord(store, CANONICAL)).store;
      store = unwrap(admitProjectionPolicy(store, policy)).store;
      return projectAccessState(store);
    }
    function buildReversed(): ReturnType<typeof projectAccessState> {
      let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
      store = unwrap(admitProjectionPolicy(store, policy)).store;
      store = unwrap(admitCanonicalRecord(store, CANONICAL)).store;
      return projectAccessState(store);
    }
    expect(build()).toEqual(buildReversed());
    expect(JSON.stringify(build())).toBe(JSON.stringify(buildReversed()));
  });

  it('the derived projection-state projection counts everything deterministically', () => {
    let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    store = unwrap(admitProjectionPolicy(store, unwrap(sealProjectionPolicy(standardPolicyContent())))).store;
    store = unwrap(admitCanonicalRecord(store, CANONICAL)).store;
    const view = evaluateFor(CLIENT, ROLE_CLIENT, T3);
    if (view.outcome !== 'released') throw new Error('expected released');
    store = unwrap(appendAuditRecord(store, view.audit)).store;
    store = unwrap(admitProjection(store, view.projection)).store;
    const denied = evaluateFor(CLIENT, ROLE_CLIENT, T4);
    if (denied.outcome !== 'released') throw new Error('expected released');
    const state = projectAccessState(store);
    expect(state.policyCount).toBe(1);
    expect(state.policyRevisionCount).toBe(1);
    expect(state.recordCount).toBe(1);
    expect(state.recordsByClass).toEqual([{ objectClass: 'program-of-work', count: 1 }]);
    expect(state.projectionCount).toBe(1);
    expect(state.auditCount).toBe(1);
    expect(state.releasedAuditCount).toBe(1);
    expect(state.deniedAuditCount).toBe(0);
  });
});

describe('contract emission determinism', () => {
  it('two renders are byte-identical', () => {
    expect(renderAccessProjectionContractFiles()).toEqual(renderAccessProjectionContractFiles());
  });
});
