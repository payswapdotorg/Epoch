// The W041 negative evaluation evidence — every named typed rejection:
// authorization-bypass-rejected, authorization-denied,
// export-without-grant-rejected, share-without-grant-rejected,
// task-escalation-rejected, field-leak-rejected,
// identity-fork-rejected, tenant-isolation-rejected,
// policy-binding-missing, digest-mismatch, replay-conflict,
// dangling-reference-rejected, version-conflict.
import { describe, expect, it } from 'vitest';
import { sealAuthorizationDecision } from '@epoch/authorization';
import { buildProgramOfWork } from '@epoch/solution-delivery';
import {
  admitProjection,
  appendAuditRecord,
  canonicalObjectIdentity,
  evaluateProjection,
  openAccessProjectionStore,
  sealAuthorizedProjection,
  sealProjectionAudit,
  sealProjectionPolicy,
  admitProjectionPolicy,
  admitCanonicalRecord,
  type ProjectionEvaluationInput,
  type SealedProjectionPolicy,
} from '../src/index';
import {
  unwrap,
  accessRequest,
  allowContext,
  expectError,
  withoutDigest,
  foreignMembershipContext,
  inactivePrincipalContext,
  sealedDecision,
  unknownPrincipalContext,
} from './helpers';
import {
  AGENT,
  CLIENT,
  DELIVERY_ID,
  ENGINEER,
  EVIDENCE_DIGEST_A,
  HOST,
  PROGRAM_ID,
  ROLE_AGENT,
  ROLE_CLIENT,
  SERVICE_PRINCIPAL,
  TASK_CLASS,
  TENANT,
  OTHER_TENANT,
  T3,
  sealedDelivery,
  sealedProgram,
  standardPolicyContent,
} from './fixtures';

const PROGRAM = sealedProgram();
const CANONICAL = { objectClass: 'program-of-work' as const, record: PROGRAM };
const IDENTITY = canonicalObjectIdentity(CANONICAL);

function policy(): SealedProjectionPolicy {
  return unwrap(sealProjectionPolicy(standardPolicyContent()));
}

function baseInput(overrides: Partial<ProjectionEvaluationInput> = {}): ProjectionEvaluationInput {
  const subject = {
    principalId: CLIENT,
    principalKind: 'human' as const,
    role: ROLE_CLIENT,
  };
  const request = accessRequest(CLIENT, 'view', {
    resourceType: 'program-of-work',
    resourceId: PROGRAM_ID,
    tenantId: TENANT,
  });
  return {
    request,
    decision: sealedDecision(request, allowContext(CLIENT)),
    policy: policy(),
    record: CANONICAL,
    subject,
    projectedAt: T3,
    projectedBy: HOST,
    ...overrides,
  };
}

describe('authorization-bypass-rejected (stage 1 always precedes the projection stage)', () => {
  it('a missing decision record is rejected (the kernel refuses to project without one)', () => {
    const error = expectError(
      evaluateProjection({ ...baseInput(), decision: undefined as never }),
      'authorization-bypass-rejected',
    );
    if (error.code === 'authorization-bypass-rejected') {
      expect(error.reason).toBe('decision-missing');
    }
  });

  it('an unverifiable decision digest is rejected (tampered envelope)', () => {
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const decision = sealedDecision(request, allowContext(CLIENT));
    const error = expectError(
      evaluateProjection({
        ...baseInput(),
        decision: { decision: decision.decision, digest: 'f'.repeat(64) },
      }),
      'authorization-bypass-rejected',
    );
    if (error.code === 'authorization-bypass-rejected') {
      expect(error.reason).toBe('decision-unverifiable');
    }
  });

  it('a decision minted for ANOTHER request is rejected (requestDigest mismatch)', () => {
    const otherRequest = accessRequest(ENGINEER, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const error = expectError(
      evaluateProjection({
        ...baseInput(),
        decision: sealedDecision(otherRequest, allowContext(ENGINEER)),
      }),
      'authorization-bypass-rejected',
    );
    if (error.code === 'authorization-bypass-rejected') {
      expect(error.reason).toBe('request-digest-mismatch');
    }
  });

  it('a decision answering ANOTHER principal is rejected', () => {
    const request = accessRequest(ENGINEER, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const error = expectError(
      evaluateProjection({
        ...baseInput(),
        request,
        decision: sealedDecision(request, allowContext(ENGINEER)),
      }),
      'authorization-bypass-rejected',
    );
    if (error.code === 'authorization-bypass-rejected') {
      expect(error.reason).toBe('principal-mismatch');
    }
  });

  it('a decision covering ANOTHER resource is rejected', () => {
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: 'program:some-other-program',
      tenantId: TENANT,
    });
    const error = expectError(
      evaluateProjection({
        ...baseInput(),
        request,
        decision: sealedDecision(request, allowContext(CLIENT)),
      }),
      'authorization-bypass-rejected',
    );
    if (error.code === 'authorization-bypass-rejected') {
      expect(error.reason).toBe('resource-mismatch');
    }
  });

  it('a non-access action kind is rejected', () => {
    const request = {
      schemaVersion: 1 as const,
      principalId: CLIENT,
      actionKind: 'procurement.intake',
      resource: { resourceType: 'program-of-work', resourceId: PROGRAM_ID, tenantId: TENANT },
    };
    const error = expectError(
      evaluateProjection({
        ...baseInput(),
        request,
        decision: sealedDecision(request, allowContext(CLIENT)),
      }),
      'authorization-bypass-rejected',
    );
    if (error.code === 'authorization-bypass-rejected') {
      expect(error.reason).toBe('action-kind-unknown');
    }
  });
});

describe('authorization-denied (a well-formed prior DENY never reaches the projection stage)', () => {
  it('a REAL W009 deny (unknown principal) is the typed authorization-denied', () => {
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const decision = sealedDecision(request, unknownPrincipalContext());
    expect(decision.decision.outcome).toBe('deny');
    const error = expectError(
      evaluateProjection({ ...baseInput(), request, decision }),
      'authorization-denied',
    );
    if (error.code === 'authorization-denied') {
      expect(error.outcome).toBe('deny');
      expect(error.denialCode).toBe('unknown-principal');
    }
  });

  it('a REAL cross-tenant deny is authorization-denied with the W009 code', () => {
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const decision = sealedDecision(request, foreignMembershipContext(CLIENT));
    const error = expectError(
      evaluateProjection({ ...baseInput(), request, decision }),
      'authorization-denied',
    );
    if (error.code === 'authorization-denied') {
      expect(error.denialCode).toBe('cross-tenant-denied');
    }
  });

  it('a REAL inactive-principal deny is authorization-denied', () => {
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const decision = sealedDecision(request, inactivePrincipalContext(CLIENT));
    const error = expectError(
      evaluateProjection({ ...baseInput(), request, decision }),
      'authorization-denied',
    );
    if (error.code === 'authorization-denied') {
      expect(error.denialCode).toBe('inactive-principal');
    }
  });

  it('a hand-crafted allow with a foreign tenant scope is tenant-isolation-rejected', () => {
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: OTHER_TENANT,
    });
    const decision = sealedDecision(request, allowContext(CLIENT, OTHER_TENANT));
    expect(decision.decision.outcome).toBe('allow');
    const error = expectError(
      evaluateProjection({ ...baseInput(), request, decision }),
      'tenant-isolation-rejected',
    );
    if (error.code === 'tenant-isolation-rejected') {
      expect(error.expectedTenantId).toBe(TENANT);
      expect(error.encounteredTenantId).toBe(OTHER_TENANT);
    }
  });

  it('a policy from another tenant is tenant-isolation-rejected', () => {
    const foreignPolicy = unwrap(
      sealProjectionPolicy(standardPolicyContent({ tenantId: OTHER_TENANT })),
    );
    expectError(evaluateProjection({ ...baseInput(), policy: foreignPolicy }), 'tenant-isolation-rejected');
  });

  it('a tampered canonical record is digest-mismatch (W036 verification never bypassed)', () => {
    const tampered = {
      objectClass: 'program-of-work' as const,
      record: { ...PROGRAM, contentDigest: 'e'.repeat(64) },
    };
    expectError(evaluateProjection({ ...baseInput(), record: tampered }), 'digest-mismatch');
  });

  it('a tampered policy is digest-mismatch', () => {
    const tampered = { ...policy(), contentDigest: 'e'.repeat(64) };
    expectError(evaluateProjection({ ...baseInput(), policy: tampered }), 'digest-mismatch');
  });

  it('a RETIRED policy revision is lifecycle-conflict (never projects again)', () => {
    const retired = unwrap(
      sealProjectionPolicy(standardPolicyContent({ revision: 2, status: 'retired' })),
    );
    expectError(evaluateProjection({ ...baseInput(), policy: retired }), 'lifecycle-conflict');
  });
});

describe('policy-binding-missing (fail-closed, audited denial)', () => {
  it('a role with no row is denied WITH a sealed audit record', () => {
    const subject = {
      principalId: SERVICE_PRINCIPAL,
      principalKind: 'human' as const,
      role: 'role:unlisted-role',
    };
    const request = accessRequest(SERVICE_PRINCIPAL, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const result = unwrap(
      evaluateProjection({
        request,
        decision: sealedDecision(request, allowContext(SERVICE_PRINCIPAL)),
        policy: policy(),
        record: CANONICAL,
        subject,
        projectedAt: T3,
        projectedBy: HOST,
      }),
    );
    expect(result.outcome).toBe('denied');
    if (result.outcome !== 'denied') return;
    expect(result.denial.code).toBe('policy-binding-missing');
    expect(result.audit.outcome).toBe('denied');
    expect(result.audit.denialCode).toBe('policy-binding-missing');
    expect(result.audit.fieldsReleased).toEqual([]);
  });

  it('an object class with no row is denied (the closed class set)', () => {
    const subject = {
      principalId: CLIENT,
      principalKind: 'human' as const,
      role: ROLE_CLIENT,
    };
    // The policy has no delivery-record rows: a REAL delivery record
    // under the same policy is a fail-closed denial.
    const delivery = { objectClass: 'delivery-record' as const, record: sealedDelivery() };
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'delivery-record',
      resourceId: DELIVERY_ID,
      tenantId: TENANT,
    });
    const result = unwrap(
      evaluateProjection({
        request,
        decision: sealedDecision(request, allowContext(CLIENT)),
        policy: policy(),
        record: delivery,
        subject,
        projectedAt: T3,
        projectedBy: HOST,
      }),
    );
    expect(result.outcome).toBe('denied');
    if (result.outcome !== 'denied') return;
    expect(result.denial.code).toBe('policy-binding-missing');
    expect(result.audit.objectClass).toBe('delivery-record');
  });
});

describe('export-without-grant-rejected / share-without-grant-rejected (audited denials)', () => {
  const subject = { principalId: CLIENT, principalKind: 'human' as const, role: ROLE_CLIENT };

  function deniedFor(action: 'export' | 'share') {
    const request = accessRequest(CLIENT, action, {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    return unwrap(
      evaluateProjection({
        request,
        decision: sealedDecision(request, allowContext(CLIENT)),
        policy: policy(),
        record: CANONICAL,
        subject,
        projectedAt: T3,
        projectedBy: HOST,
      }),
    );
  }

  it('a viewable-but-not-exportable object yields the typed export denial (WITH audit)', () => {
    const result = deniedFor('export');
    expect(result.outcome).toBe('denied');
    if (result.outcome !== 'denied') return;
    expect(result.denial.code).toBe('export-without-grant-rejected');
    expect(result.audit.outcome).toBe('denied');
    expect(result.audit.denialCode).toBe('export-without-grant-rejected');
    expect(result.audit.action).toBe('export');
  });

  it('a viewable-but-not-shareable object yields the typed share denial (WITH audit)', () => {
    const result = deniedFor('share');
    expect(result.outcome).toBe('denied');
    if (result.outcome !== 'denied') return;
    expect(result.denial.code).toBe('share-without-grant-rejected');
    expect(result.audit.denialCode).toBe('share-without-grant-rejected');
  });
});

describe('task-escalation-rejected (task rows are narrower, never wider)', () => {
  it('a task row wider than the agent role baseline is denied WITH audit', () => {
    const escalatedPolicy = unwrap(
      sealProjectionPolicy(
        standardPolicyContent({
          bindings: [
            {
              selector: { principalKind: 'agent', role: ROLE_AGENT },
              objectClass: 'program-of-work',
              allowedActions: ['view'],
              fieldAllowlist: [
                'schema',
                'programId',
                'title',
                'workPackages[].workPackageId',
                'workPackages[].title',
                'workPackages[].activities[].activityId',
                'workPackages[].activities[].title',
                'workPackages[].activities[].actualProgress',
              ].sort(),
              redactionRules: [],
              defaultRedactionClass: 'policy-scoped',
              scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
            },
            {
              // The TASK row grants a field the ROLE baseline lacks.
              selector: { principalKind: 'agent', agentTaskClass: TASK_CLASS },
              objectClass: 'program-of-work',
              allowedActions: ['view'],
              fieldAllowlist: [
                'schema',
                'programId',
                'title',
                'workPackages[].workPackageId',
                'workPackages[].title',
                'workPackages[].realizationVariant',
                'workPackages[].activities[].activityId',
                'workPackages[].activities[].title',
                'workPackages[].activities[].actualProgress',
                'workPackages[].activities[].plannedCost.amount',
              ].sort(),
              redactionRules: [],
              defaultRedactionClass: 'policy-scoped',
              scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
            },
          ],
        }),
      ),
    );
    const subject = {
      principalId: AGENT,
      principalKind: 'agent' as const,
      role: ROLE_AGENT,
      agentTaskClass: TASK_CLASS,
    };
    const request = accessRequest(AGENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const result = unwrap(
      evaluateProjection({
        request,
        decision: sealedDecision(request, allowContext(AGENT)),
        policy: escalatedPolicy,
        record: CANONICAL,
        subject,
        taskContext: {
          taskClass: TASK_CLASS,
          workPackageIds: ['work-package:earthworks'],
          activityIds: [],
        },
        projectedAt: T3,
        projectedBy: HOST,
      }),
    );
    expect(result.outcome).toBe('denied');
    if (result.outcome !== 'denied') return;
    expect(result.denial.code).toBe('task-escalation-rejected');
    expect(result.audit.denialCode).toBe('task-escalation-rejected');
  });

  it('a task context on a NON-agent subject is a typed validation error', () => {
    expectError(
      evaluateProjection({
        ...baseInput(),
        taskContext: {
          taskClass: TASK_CLASS,
          workPackageIds: ['work-package:earthworks'],
          activityIds: [],
        },
      }),
      'validation',
    );
  });
});

describe('field-leak-rejected / identity-fork-rejected (admission defense-in-depth)', () => {
  function loadedStore() {
    let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    store = unwrap(admitProjectionPolicy(store, policy())).store;
    store = unwrap(admitCanonicalRecord(store, CANONICAL)).store;
    return store;
  }

  function releasedClientView() {
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const result = unwrap(
      evaluateProjection({
        request,
        decision: sealedDecision(request, allowContext(CLIENT)),
        policy: policy(),
        record: CANONICAL,
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        projectedAt: T3,
        projectedBy: HOST,
      }),
    );
    if (result.outcome !== 'released') throw new Error('expected a released projection');
    return result.projection;
  }

  it('a hand-crafted projection releasing a policy-denied field is field-leak-rejected', () => {
    const store = loadedStore();
    const projection = releasedClientView();
    const projectionContent = withoutDigest(projection);
    // Flip the redacted commercial field to RELEASED (a forged leak) and
    // re-seal so the digest is internally consistent.
    const forged = {
      ...projectionContent,
      entries: projection.entries.map((entry) =>
        entry.path === 'workPackages[0].activities[1].plannedCost.amount'
          ? { kind: 'released' as const, path: entry.path, value: '1200.50' }
          : entry,
      ),
    };
    const sealed = unwrap(sealAuthorizedProjection(forged));
    const error = expectError(admitProjection(store, sealed), 'field-leak-rejected');
    if (error.code === 'field-leak-rejected') {
      expect(error.leakedPaths).toContain('workPackages[0].activities[1].plannedCost.amount');
    }
  });

  it('field-leak-rejected: the denied VALUE never appears anywhere in the legit projection', () => {
    const projection = releasedClientView();
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain('1200.50');
    // The denied evidence digests are absent too (the client's evidence
    // scope is `none`).
    expect(serialized).not.toContain(EVIDENCE_DIGEST_A);
  });

  it('a projection citing a non-canonical digest is identity-fork-rejected', () => {
    const store = loadedStore();
    const projection = releasedClientView();
    const projectionContent = withoutDigest(projection);
    const forked = unwrap(
      sealAuthorizedProjection({ ...projectionContent, objectDigest: 'f'.repeat(64) }),
    );
    const error = expectError(admitProjection(store, forked), 'identity-fork-rejected');
    if (error.code === 'identity-fork-rejected') {
      expect(error.objectId).toBe(PROGRAM_ID);
      expect(error.expectedObjectDigest).toBe(IDENTITY.objectDigest);
      expect(error.encounteredObjectDigest).toBe('f'.repeat(64));
    }
  });

  it('a projection citing an unadmitted object is dangling-reference-rejected', () => {
    const store = loadedStore();
    const projection = releasedClientView();
    const projectionContent = withoutDigest(projection);
    const orphan = unwrap(
      sealAuthorizedProjection({ ...projectionContent, objectId: 'program:never-admitted' }),
    );
    expectError(admitProjection(store, orphan), 'dangling-reference-rejected');
  });

  it('a projection citing an unadmitted policy revision is dangling-reference-rejected', () => {
    const store = loadedStore();
    const projection = releasedClientView();
    const projectionContent = withoutDigest(projection);
    const orphan = unwrap(
      sealAuthorizedProjection({
        ...projectionContent,
        policyRef: { policyId: 'policy:never-admitted', revision: 1, policyDigest: 'a'.repeat(64) },
      }),
    );
    expectError(admitProjection(store, orphan), 'dangling-reference-rejected');
  });
});

describe('replay-conflict (the audit trail refuses to fork)', () => {
  it('the same evaluation key with DIFFERENT content is the typed replay-conflict', () => {
    let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const result = unwrap(
      evaluateProjection({
        request,
        decision: sealedDecision(request, allowContext(CLIENT)),
        policy: policy(),
        record: CANONICAL,
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        projectedAt: T3,
        projectedBy: HOST,
      }),
    );
    if (result.outcome !== 'released') throw new Error('expected released');
    store = unwrap(appendAuditRecord(store, result.audit)).store;

    // A FORGED sibling: same evaluation key, different released-path
    // list (legitimately sealed — the trail detects the fork by KEY).
    const auditContent = withoutDigest(result.audit);
    const forged = unwrap(
      sealProjectionAudit({
        ...auditContent,
        fieldsReleased: [...result.audit.fieldsReleased, 'title.does.not.exist'].sort(),
      }),
    );
    const error = expectError(appendAuditRecord(store, forged), 'replay-conflict');
    if (error.code === 'replay-conflict') {
      expect(error.evaluationKey).toBe(result.audit.evaluationKey);
      expect(error.sealedDigest).toBe(result.audit.contentDigest);
      expect(error.encounteredDigest).toBe(forged.contentDigest);
    }
  });

  it('a duplicate evaluation appends the SEALED PRIOR audit record (idempotent)', () => {
    let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const request = accessRequest(CLIENT, 'view', {
      resourceType: 'program-of-work',
      resourceId: PROGRAM_ID,
      tenantId: TENANT,
    });
    const input = {
      request,
      decision: sealedDecision(request, allowContext(CLIENT)),
      policy: policy(),
      record: CANONICAL,
      subject: { principalId: CLIENT, principalKind: 'human' as const, role: ROLE_CLIENT },
      projectedAt: T3,
      projectedBy: HOST,
    };
    const first = unwrap(evaluateProjection(input));
    if (first.outcome !== 'released') throw new Error('expected released');
    store = unwrap(appendAuditRecord(store, first.audit)).store;
    const replay = unwrap(evaluateProjection(input));
    if (replay.outcome !== 'released') throw new Error('expected released');
    const appended = unwrap(appendAuditRecord(store, replay.audit));
    expect(appended.outcome.kind).toBe('duplicate-audit-returned');
    expect(appended.outcome.audit.contentDigest).toBe(first.audit.contentDigest);
    expect(appended.store.audits).toHaveLength(1);
  });
});

describe('version-conflict (immutable canonical records)', () => {
  it('a second content under one program id is version-conflict at admission', () => {
    let store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    store = unwrap(admitCanonicalRecord(store, CANONICAL)).store;
    const programContent = withoutDigest(PROGRAM);
    const divergent = {
      objectClass: 'program-of-work' as const,
      record: unwrap(
        buildProgramOfWork({
          ...programContent,
          title: 'A divergent program',
        }),
      ),
    };
    const error = expectError(admitCanonicalRecord(store, divergent), 'version-conflict');
    if (error.code === 'version-conflict') {
      expect(error.expectedDigest).toBe(IDENTITY.objectDigest);
    }
  });
});

describe('the W009 seam never re-implemented (decisions are consumed, not recomputed)', () => {
  it('a decision sealed by the REAL W009 pipeline is the only accepted shape', () => {
    // A hand-minted "allow" (not from the evaluator) still carries a
    // valid W009 shape only if it parses; a garbage decision is
    // rejected as unverifiable.
    const garbage = sealAuthorizationDecision({
      schemaVersion: 1,
      requestDigest: '0'.repeat(64),
      outcome: 'allow',
      reasons: ['covering-membership'],
      evidence: ['request.principalId'],
    });
    if (!garbage.ok) throw new Error('fixture failed');
    const error = expectError(
      evaluateProjection({ ...baseInput(), decision: garbage.value }),
      'authorization-bypass-rejected',
    );
    if (error.code === 'authorization-bypass-rejected') {
      expect(error.reason).toBe('request-digest-mismatch');
    }
  });
});
