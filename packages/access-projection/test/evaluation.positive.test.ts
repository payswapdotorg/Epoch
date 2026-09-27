// The W041 ACCEPTANCE fixtures and the positive evaluation evidence:
//
// - THE ACCEPTANCE (verbatim from the Work Order): two authorized roles
//   receive DIFFERENT projections of ONE semantic object (same id,
//   different field visibility) with no duplicate authorities and no
//   field leaks outside policy — one named fixture test with a full
//   audit record pair;
// - policy-as-data: swapping a policy revision changes the projection
//   with ZERO code change;
// - service-to-service projections follow the same two-stage path;
// - agent task-specific projections narrow to the task's object scope;
// - export/share rulings;
// - redaction markers carry path + policy clause + redaction class;
// - released fields pass through BY REFERENCE.
import { describe, expect, it } from 'vitest';
import {
  canonicalObjectIdentity,
  evaluateProjection,
  redactedPathsOf,
  releasedPathsOf,
  releasedValueOf,
  selectVisiblePaths,
  selectRoleBinding,
  sealProjectionPolicy,
  walkSchemaLeaves,
  canonicalRecordSchemaOf,
  type ProjectionEvaluation,
  type SealedProjectionPolicy,
} from '../src/index';
import { authorityViolationError } from '../src/issues';
import { unwrap, accessRequest, allowContext, sealedDecision } from './helpers';
import {
  AGENT,
  CLIENT,
  ENGINEER,
  HOST,
  PROGRAM_ID,
  ROLE_AGENT,
  ROLE_CLIENT,
  ROLE_ENGINEER,
  ROLE_SERVICE,
  SERVICE_PRINCIPAL,
  TASK_CLASS,
  TENANT,
  T3,
  T4,
  sealedProgram,
  standardPolicyContent,
} from './fixtures';

const PROGRAM = sealedProgram();
const CANONICAL = { objectClass: 'program-of-work' as const, record: PROGRAM };
const IDENTITY = canonicalObjectIdentity(CANONICAL);
const LEAVES = walkSchemaLeaves(canonicalRecordSchemaOf('program-of-work'), PROGRAM);
const LEAF_PATHS = LEAVES.map((leaf) => leaf.path).sort();

function policy(): SealedProjectionPolicy {
  return unwrap(sealProjectionPolicy(standardPolicyContent()));
}

/** Evaluate one subject's view of the fixture program through the REAL pipeline. */
function evaluateFor(
  subject: Parameters<typeof evaluateProjection>[0]['subject'],
  sealedPolicy: SealedProjectionPolicy,
  options: {
    action?: 'view' | 'export' | 'share';
    taskContext?: Parameters<typeof evaluateProjection>[0]['taskContext'];
    principalId?: string;
    projectedAt?: string;
  } = {},
): ProjectionEvaluation {
  const principalId = options.principalId ?? subject.principalId;
  const request = accessRequest(principalId, options.action ?? 'view', {
    resourceType: 'program-of-work',
    resourceId: PROGRAM_ID,
    tenantId: TENANT,
  });
  const decision = sealedDecision(request, allowContext(principalId));
  return unwrap(
    evaluateProjection({
      request,
      decision,
      policy: sealedPolicy,
      record: CANONICAL,
      subject,
      ...(options.taskContext !== undefined ? { taskContext: options.taskContext } : {}),
      projectedAt: options.projectedAt ?? T3,
      projectedBy: HOST,
    }),
  );
}

describe('the W041 acceptance fixture (two roles, one object, different projections)', () => {
  const sealedPolicy = policy();
  const clientSubject = {
    principalId: CLIENT,
    principalKind: 'human' as const,
    role: ROLE_CLIENT,
  };
  const engineerSubject = {
    principalId: ENGINEER,
    principalKind: 'human' as const,
    role: ROLE_ENGINEER,
  };
  const clientView = evaluateFor(clientSubject, sealedPolicy);
  const engineerView = evaluateFor(engineerSubject, sealedPolicy);

  it('both authorized roles receive RELEASED projections of the ONE semantic object', () => {
    expect(clientView.outcome).toBe('released');
    expect(engineerView.outcome).toBe('released');
    if (clientView.outcome !== 'released' || engineerView.outcome !== 'released') return;
    expect(clientView.projection.objectId).toBe(PROGRAM_ID);
    expect(engineerView.projection.objectId).toBe(PROGRAM_ID);
    expect(clientView.projection.objectDigest).toBe(IDENTITY.objectDigest);
    expect(engineerView.projection.objectDigest).toBe(IDENTITY.objectDigest);
  });

  it('identity-fork-rejected invariant (positive): the two projections SHARE the object id', () => {
    if (clientView.outcome !== 'released' || engineerView.outcome !== 'released') return;
    expect(clientView.projection.objectClass).toBe(engineerView.projection.objectClass);
    expect(clientView.projection.objectId).toBe(engineerView.projection.objectId);
    expect(clientView.projection.objectDigest).toBe(engineerView.projection.objectDigest);
    // The projections never mint identities: no projection-local id field
    // exists, and the canonical record is unchanged by projection.
    expect(
      Object.keys(clientView.projection).some((key) => /localId|projectionId/i.test(key)),
    ).toBe(false);
    expect(canonicalObjectIdentity(CANONICAL).objectDigest).toBe(PROGRAM.contentDigest);
  });

  it('the two roles receive DIFFERENT field visibility (cost + evidence)', () => {
    if (clientView.outcome !== 'released' || engineerView.outcome !== 'released') return;
    const clientReleased = new Set(releasedPathsOf(clientView.projection));
    const engineerReleased = new Set(releasedPathsOf(engineerView.projection));
    expect(clientReleased.size).toBeGreaterThan(0);
    expect(engineerReleased.size).toBeGreaterThan(clientReleased.size);

    // The client NEVER sees cost or evidence; the engineer sees both
    // (their policy grants them).
    for (const path of engineerReleased) {
      if (path.includes('plannedCost') || path.includes('evidence')) {
        expect(clientReleased.has(path), `client leaked ${path}`).toBe(false);
      }
    }
    const costPath = 'workPackages[0].activities[1].plannedCost.amount';
    expect(engineerReleased.has(costPath)).toBe(true);
    const evidencePath = 'workPackages[0].activities[0].evidence[0].digest';
    expect(engineerReleased.has(evidencePath)).toBe(true);
    // The engineer's evidence scope is LISTED: digest C (the milestone
    // evidence) is not in the allowlist.
    expect(
      releasedPathsOf(engineerView.projection).includes('milestones[0].evidence[0].digest'),
    ).toBe(false);
  });

  it('redaction-marker-required: every walked leaf appears exactly once — released or marked', () => {
    if (clientView.outcome !== 'released' || engineerView.outcome !== 'released') return;
    for (const projection of [clientView.projection, engineerView.projection]) {
      const paths = projection.entries.map((entry) => entry.path);
      expect([...paths].sort()).toEqual(LEAF_PATHS);
      for (const entry of projection.entries) {
        if (entry.kind === 'redacted') {
          expect(entry.clause.policyId).toBe(sealedPolicy.policyId);
          expect(entry.clause.revision).toBe(sealedPolicy.revision);
          expect(entry.clause.bindingIndex).toBeGreaterThanOrEqual(1);
          expect([
            'commercial-sensitive',
            'supplier-sensitive',
            'evidence-scoped',
            'principal-identifying',
            'policy-scoped',
            'task-scoped',
          ]).toContain(entry.redactionClass);
        } else {
          expect(typeof entry.path).toBe('string');
        }
      }
    }
    // The client's cost fields carry the COMMERCIAL-SENSITIVE class
    // (the policy's redaction rule), the evidence fields the
    // EVIDENCE-SCOPED class.
    const clientCost = clientView.projection.entries.find(
      (entry) => entry.path === 'workPackages[0].activities[1].plannedCost.amount',
    );
    expect(clientCost).toMatchObject({ kind: 'redacted', redactionClass: 'commercial-sensitive' });
    const clientEvidence = clientView.projection.entries.find(
      (entry) => entry.path === 'workPackages[0].activities[0].evidence[0].digest',
    );
    expect(clientEvidence).toMatchObject({ kind: 'redacted', redactionClass: 'evidence-scoped' });
  });

  it('released fields pass through BY REFERENCE (same value, same digest)', () => {
    if (clientView.outcome !== 'released' || engineerView.outcome !== 'released') return;
    expect(releasedValueOf(clientView.projection, 'title')).toBe(PROGRAM.title);
    expect(releasedValueOf(clientView.projection, 'workPackages[0].title')).toBe(
      PROGRAM.workPackages[0]!.title,
    );
    expect(releasedValueOf(engineerView.projection, 'workPackages[0].activities[1].plannedCost.amount')).toBe(
      PROGRAM.workPackages[0]!.activities[1]!.plannedCost!.amount,
    );
    expect(releasedValueOf(engineerView.projection, 'workPackages[0].activities[0].evidence[0].digest')).toBe(
      PROGRAM.workPackages[0]!.activities[0]!.evidence[0]!.digest,
    );
  });

  it('no field leaks outside policy: released paths equal the policy-derived selection EXACTLY', () => {
    if (clientView.outcome !== 'released' || engineerView.outcome !== 'released') return;
    const clientBinding = selectRoleBinding(
      sealedPolicy,
      { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
      'program-of-work',
    )!;
    const engineerBinding = selectRoleBinding(
      sealedPolicy,
      { principalId: ENGINEER, principalKind: 'human', role: ROLE_ENGINEER },
      'program-of-work',
    )!;
    expect(releasedPathsOf(clientView.projection)).toEqual([
      ...selectVisiblePaths(clientBinding, CANONICAL, undefined).released,
    ]);
    expect(releasedPathsOf(engineerView.projection)).toEqual([
      ...selectVisiblePaths(engineerBinding, CANONICAL, undefined).released,
    ]);
  });

  it('no duplicate authorities: projections carry no authority-claim fields', () => {
    if (clientView.outcome !== 'released' || engineerView.outcome !== 'released') return;
    for (const projection of [clientView.projection, engineerView.projection]) {
      expect(authorityViolationError(projection)).toBeNull();
      expect(
        authorityViolationError(JSON.parse(JSON.stringify(projection.entries))),
      ).toBeNull();
    }
  });

  it('the full audit record pair (released decisions are content-addressed and complete)', () => {
    if (clientView.outcome !== 'released' || engineerView.outcome !== 'released') return;
    for (const view of [clientView, engineerView]) {
      const audit = view.audit;
      expect(audit.outcome).toBe('released');
      expect(audit.tenantId).toBe(TENANT);
      expect(audit.principalId).toBe(view.projection.subject.principalId);
      expect(audit.objectId).toBe(PROGRAM_ID);
      expect(audit.objectDigest).toBe(IDENTITY.objectDigest);
      expect(audit.action).toBe('view');
      expect(audit.policyRef.policyDigest).toBe(sealedPolicy.contentDigest);
      expect(audit.decisionDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(audit.evaluationKey).toMatch(/^[0-9a-f]{64}$/);
      expect(audit.auditId).toMatch(/^audit:[0-9a-f]{16}$/);
      expect(audit.provenance.kind).toBe('derived');
      expect(audit.fieldsReleased).toEqual(releasedPathsOf(view.projection));
      expect(audit.fieldsRedacted).toEqual(redactedPathsOf(view.projection));
      expect(audit.projectedAt).toBe(T3);
      expect(audit.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
    // The pair is TWO records (one per subject), distinct but over the
    // same object.
    expect(clientView.audit.principalId).toBe(CLIENT);
    expect(engineerView.audit.principalId).toBe(ENGINEER);
    expect(clientView.audit.contentDigest).not.toBe(engineerView.audit.contentDigest);
    expect(clientView.audit.objectId).toBe(engineerView.audit.objectId);
  });
});

describe('policy-as-data (swapping a policy revision changes the projection, zero code change)', () => {
  it('revision 1 hides commercial from the client; revision 2 reveals it — same object, same decision seam', () => {
    const subject = { principalId: CLIENT, principalKind: 'human' as const, role: ROLE_CLIENT };
    const rev1 = unwrap(sealProjectionPolicy(standardPolicyContent()));
    const view1 = evaluateFor(subject, rev1);
    expect(view1.outcome).toBe('released');
    if (view1.outcome !== 'released') return;
    expect(releasedPathsOf(view1.projection)).not.toContain(
      'workPackages[0].activities[1].plannedCost.amount',
    );

    // ONLY the policy data changes: the same code path, the same
    // canonical record, a new revision whose client row grants the
    // commercial section.
    const rev2Content = standardPolicyContent({
      revision: 2,
      bindings: [
        {
          selector: { principalKind: 'human', role: ROLE_CLIENT },
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
            'workPackages[].activities[].plannedCost.amount',
            'workPackages[].activities[].plannedCost.currency',
          ].sort(),
          redactionRules: [],
          defaultRedactionClass: 'policy-scoped',
          scopeFilters: { evidence: { mode: 'none' }, commercial: 'visible', supplier: 'hidden' },
        },
      ],
    });
    const rev2 = unwrap(sealProjectionPolicy(rev2Content));
    const view2 = evaluateFor(subject, rev2);
    expect(view2.outcome).toBe('released');
    if (view2.outcome !== 'released') return;
    expect(releasedPathsOf(view2.projection)).toContain(
      'workPackages[0].activities[1].plannedCost.amount',
    );
    expect(view2.projection.policyRef.revision).toBe(2);
    expect(view2.projection.policyRef.policyDigest).toBe(rev2.contentDigest);
  });
});

describe('service-to-service authorization (a service principal follows the same two-stage path)', () => {
  it('a service role row yields a projection through the identical pipeline', () => {
    const subject = {
      principalId: SERVICE_PRINCIPAL,
      principalKind: 'service' as const,
      role: ROLE_SERVICE,
    };
    const view = evaluateFor(subject, policy());
    expect(view.outcome).toBe('released');
    if (view.outcome !== 'released') return;
    expect(view.projection.subject.principalKind).toBe('service');
    expect(view.audit.subject.principalKind).toBe('service');
    expect(releasedPathsOf(view.projection)).not.toContain(
      'workPackages[0].activities[1].plannedCost.amount',
    );
  });
});

describe('agent task-specific projections (narrower than the role baseline)', () => {
  const agentSubject = {
    principalId: AGENT,
    principalKind: 'agent' as const,
    role: ROLE_AGENT,
    agentTaskClass: TASK_CLASS,
  };
  const taskContext = {
    taskClass: TASK_CLASS,
    workPackageIds: ['work-package:earthworks'],
    activityIds: [],
  };

  it('the task projection narrows to the task object scope (task-scoped markers outside)', () => {
    const sealedPolicy = unwrap(
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
                'workPackages[].realizationVariant',
                'workPackages[].activities[].activityId',
                'workPackages[].activities[].title',
                'workPackages[].activities[].actualProgress',
              ].sort(),
              redactionRules: [],
              defaultRedactionClass: 'policy-scoped',
              scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
            },
            {
              selector: { principalKind: 'agent', agentTaskClass: TASK_CLASS },
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
          ],
        }),
      ),
    );
    const view = evaluateFor(agentSubject, sealedPolicy, { taskContext });
    expect(view.outcome).toBe('released');
    if (view.outcome !== 'released') return;
    const released = releasedPathsOf(view.projection);
    // Everything released is inside the FIRST work package.
    for (const path of released) {
      expect(path.startsWith('workPackages[1]')).toBe(false);
    }
    // The second work package's fields became TASK-SCOPED markers.
    const steelTitle = view.projection.entries.find(
      (entry) => entry.path === 'workPackages[1].title',
    );
    expect(steelTitle).toMatchObject({ kind: 'redacted', redactionClass: 'task-scoped' });
    // The task context rides on the projection (the narrowing is part
    // of its identity).
    expect(view.projection.taskContext).toEqual(taskContext);
    expect(view.audit.fieldsReleased).toEqual(released);
  });
});

describe('export/share rulings (distinct actions, own policy rows)', () => {
  it('the engineer may EXPORT and SHARE (granted by their row)', () => {
    const subject = { principalId: ENGINEER, principalKind: 'human' as const, role: ROLE_ENGINEER };
    const exported = evaluateFor(subject, policy(), { action: 'export', projectedAt: T4 });
    const shared = evaluateFor(subject, policy(), { action: 'share', projectedAt: T4 });
    expect(exported.outcome).toBe('released');
    expect(shared.outcome).toBe('released');
    if (exported.outcome !== 'released' || shared.outcome !== 'released') return;
    expect(exported.projection.action).toBe('export');
    expect(shared.projection.action).toBe('share');
    expect(exported.audit.action).toBe('export');
  });

  it('a viewable-but-not-exportable object yields the typed export denial (see negative suite) and the view still releases', () => {
    const subject = { principalId: CLIENT, principalKind: 'human' as const, role: ROLE_CLIENT };
    const view = evaluateFor(subject, policy(), { projectedAt: T4 });
    expect(view.outcome).toBe('released');
  });
});

describe('determinism of the evaluation (identical inputs -> identical digests)', () => {
  it('re-evaluating the same request produces byte-identical projection and audit digests', () => {
    const subject = { principalId: CLIENT, principalKind: 'human' as const, role: ROLE_CLIENT };
    const first = evaluateFor(subject, policy());
    const second = evaluateFor(subject, policy());
    if (first.outcome !== 'released' || second.outcome !== 'released') return;
    expect(first.projection.contentDigest).toBe(second.projection.contentDigest);
    expect(first.audit.contentDigest).toBe(second.audit.contentDigest);
    expect(first.audit.evaluationKey).toBe(second.audit.evaluationKey);
    expect(JSON.stringify(first.projection)).toBe(JSON.stringify(second.projection));
  });

  it('a different instant is a different (legitimate) evaluation, not a fork', () => {
    const subject = { principalId: CLIENT, principalKind: 'human' as const, role: ROLE_CLIENT };
    const atT3 = evaluateFor(subject, policy(), { projectedAt: T3 });
    const atT4 = evaluateFor(subject, policy(), { projectedAt: T4 });
    if (atT3.outcome !== 'released' || atT4.outcome !== 'released') return;
    expect(atT3.audit.evaluationKey).not.toBe(atT4.audit.evaluationKey);
    expect(atT3.audit.contentDigest).not.toBe(atT4.audit.contentDigest);
    // The visible subset is unchanged; only the instant differs.
    expect(releasedPathsOf(atT3.projection)).toEqual(releasedPathsOf(atT4.projection));
  });
});
