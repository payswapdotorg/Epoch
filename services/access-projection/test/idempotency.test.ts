// Idempotency: re-projecting the SAME request returns the SEALED PRIOR
// records (the evaluation-key replay discipline), emits NO events, and
// leaves the state unchanged.
import { describe, expect, it } from 'vitest';
import { AccessProjectionRuntime } from '../src/index';
import {
  allowContext,
  unwrap,
  CLIENT,
  HOST_ADMIN,
  ROLE_CLIENT,
  TENANT,
  T1,
  T2,
  T3,
  T4,
  sealedProgram,
  standardPolicyContent,
} from './helpers';

describe('idempotency (duplicate evaluation = sealed prior records)', () => {
  function loadedHost() {
    const host = new AccessProjectionRuntime();
    unwrap(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        policy: standardPolicyContent(),
        registeredAt: T1,
      }),
    );
    const program = sealedProgram();
    unwrap(
      host.admitRecord({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        record: program,
        admittedAt: T2,
      }),
    );
    return { host, program };
  }

  it('the same projection request returns the prior records and emits NO events', () => {
    const { host, program } = loadedHost();
    const request = {
      authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
      tenantId: TENANT,
      recordRef: {
        objectClass: 'program-of-work' as const,
        objectId: 'program:tower-retrofit',
        objectDigest: program.contentDigest,
      },
      policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
      subject: { principalId: CLIENT, principalKind: 'human' as const, role: ROLE_CLIENT },
      action: 'view' as const,
      projectedAt: T3,
    };
    const first = unwrap(host.project(request));
    expect(first.replayed).toBe(false);
    const eventsAfterFirst = host.events().length;

    const replay = unwrap(host.project(request));
    expect(replay.replayed).toBe(true);
    if (
      first.evaluation.outcome !== 'released' ||
      replay.evaluation.outcome !== 'released'
    ) {
      throw new Error('expected released');
    }
    expect(replay.evaluation.projection.contentDigest).toBe(
      first.evaluation.projection.contentDigest,
    );
    expect(replay.evaluation.audit.contentDigest).toBe(first.evaluation.audit.contentDigest);
    // Events are FACTS: the replay emitted none.
    expect(host.events().length).toBe(eventsAfterFirst);
    expect(host.health().auditCount).toBe(1);
    expect(host.health().projectionCount).toBe(1);
  });

  it('a different instant is a fresh evaluation (new audit, new events)', () => {
    const { host, program } = loadedHost();
    const base = {
      authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
      tenantId: TENANT,
      recordRef: {
        objectClass: 'program-of-work' as const,
        objectId: 'program:tower-retrofit',
        objectDigest: program.contentDigest,
      },
      policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
      subject: { principalId: CLIENT, principalKind: 'human' as const, role: ROLE_CLIENT },
      action: 'view' as const,
    };
    unwrap(host.project({ ...base, projectedAt: T3 }));
    const second = unwrap(host.project({ ...base, projectedAt: T4 }));
    expect(second.replayed).toBe(false);
    expect(host.health().auditCount).toBe(2);
    expect(host.health().projectionCount).toBe(2);
  });
});
