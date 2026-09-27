// The full positive host flow: policy registration -> record admission
// -> the two-stage projection for two roles -> the audit trail -> the
// derived state projection -> the event streams (one object = one
// stream; events are facts).
import { describe, expect, it } from 'vitest';
import { canonicalObjectIdentity } from '@epoch/access-projection';
import { AccessProjectionRuntime } from '../src/index';
import {
  allowContext,
  unwrap,
  CLIENT,
  ENGINEER,
  HOST_ADMIN,
  PROGRAM_ID,
  ROLE_CLIENT,
  ROLE_ENGINEER,
  TENANT,
  T1,
  T2,
  T3,
  sealedPolicy,
  sealedProgram,
  standardPolicyContent,
} from './helpers';

describe('the host flow (positive)', () => {
  function loadedHost() {
    const host = new AccessProjectionRuntime();
    const policy = unwrap(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        policy: standardPolicyContent(),
        registeredAt: T1,
      }),
    );
    expect(policy.kind).toBe('policy-admitted');
    const program = sealedProgram();
    const record = unwrap(
      host.admitRecord({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        record: program,
        admittedAt: T2,
      }),
    );
    expect(record.kind).toBe('record-admitted');
    const identity = canonicalObjectIdentity({
      objectClass: 'program-of-work',
      record: program,
    });
    return { host, program, identity };
  }

  it('two authorized roles receive different projections of ONE object (the W041 acceptance, hosted)', () => {
    const { host, identity } = loadedHost();
    const project = (principalId: string, role: string, at: string) =>
      unwrap(
        host.project({
          authorization: { principalId, context: allowContext(principalId) },
          tenantId: TENANT,
          recordRef: {
            objectClass: 'program-of-work',
            objectId: identity.objectId,
            objectDigest: identity.objectDigest,
          },
          policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
          subject: { principalId, principalKind: 'human', role },
          action: 'view',
          projectedAt: at,
        }),
      );

    const clientView = project(CLIENT, ROLE_CLIENT, T3);
    const engineerView = project(ENGINEER, ROLE_ENGINEER, T3);
    expect(clientView.evaluation.outcome).toBe('released');
    expect(engineerView.evaluation.outcome).toBe('released');
    if (
      clientView.evaluation.outcome !== 'released' ||
      engineerView.evaluation.outcome !== 'released'
    ) {
      return;
    }
    const clientProjection = clientView.evaluation.projection;
    const engineerProjection = engineerView.evaluation.projection;
    // ONE semantic object: same id, same digest, different visibility.
    expect(clientProjection.objectId).toBe(PROGRAM_ID);
    expect(engineerProjection.objectId).toBe(PROGRAM_ID);
    expect(clientProjection.objectDigest).toBe(engineerProjection.objectDigest);
    const clientReleased = clientProjection.entries
      .filter((entry) => entry.kind === 'released')
      .map((entry) => entry.path);
    const engineerReleased = engineerProjection.entries
      .filter((entry) => entry.kind === 'released')
      .map((entry) => entry.path);
    expect(engineerReleased.length).toBeGreaterThan(clientReleased.length);
    expect(clientReleased).not.toContain('workPackages[0].activities[1].plannedCost.amount');
    expect(engineerReleased).toContain('workPackages[0].activities[1].plannedCost.amount');
    // The audit pair is on the trail.
    const trail = unwrap(host.auditTrail({ tenantId: TENANT }));
    expect(trail).toHaveLength(2);
  });

  it('the derived state projection counts the hosted state', () => {
    const { host, identity } = loadedHost();
    const view = unwrap(
      host.project({
        authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: identity.objectId,
          objectDigest: identity.objectDigest,
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'view',
        projectedAt: T3,
      }),
    );
    expect(view.evaluation.outcome).toBe('released');
    const state = unwrap(
      host.projectState({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        tenantId: TENANT,
        projectedAt: T3,
      }),
    );
    expect(state.policyCount).toBe(1);
    expect(state.recordCount).toBe(1);
    expect(state.projectionCount).toBe(1);
    expect(state.auditCount).toBe(1);
    expect(state.releasedAuditCount).toBe(1);
  });

  it('every step emits access-projection:* events on the target streams', () => {
    const { host, identity } = loadedHost();
    unwrap(
      host.project({
        authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: identity.objectId,
          objectDigest: identity.objectDigest,
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'view',
        projectedAt: T3,
      }),
    );
    unwrap(
      host.projectState({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        tenantId: TENANT,
        projectedAt: T3,
      }),
    );

    const programStream = host.eventStream('stream:access-program-tower-retrofit');
    expect(programStream.map((event) => event.payload.discriminator)).toEqual([
      'access-projection:record-admitted',
      'access-projection:projection-released',
      'access-projection:audit-recorded',
    ]);
    const policyStream = host.eventStream('stream:access-policy-tower-retrofit-access');
    expect(policyStream.map((event) => event.payload.discriminator)).toEqual([
      'access-projection:policy-registered',
    ]);
    const stateStream = host.eventStream('stream:access-state-tenant-globex');
    expect(stateStream.map((event) => event.payload.discriminator)).toEqual([
      'access-projection:state-projected',
    ]);
    // Sequences are 1-based and contiguous per stream.
    expect(programStream.map((event) => event.sequence)).toEqual([1, 2, 3]);
    // Health and snapshot agree.
    expect(host.health()).toMatchObject({
      tenantCount: 1,
      policyRevisionCount: 1,
      recordCount: 1,
      projectionCount: 1,
      auditCount: 1,
      eventCount: 5,
    });
    expect(host.snapshot().stores).toHaveLength(1);
  });

  it('a sealed policy registers idempotently (duplicate-policy-returned)', () => {
    const host = new AccessProjectionRuntime();
    const first = unwrap(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        policy: sealedPolicy(),
        registeredAt: T1,
      }),
    );
    const again = unwrap(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        policy: sealedPolicy(),
        registeredAt: T2,
      }),
    );
    expect(first.kind).toBe('policy-admitted');
    expect(again.kind).toBe('duplicate-policy-returned');
    expect(again.policyDigest).toBe(first.policyDigest);
  });
});
