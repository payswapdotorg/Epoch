// Determinism: two runtimes fed the same operations hold byte-identical
// snapshots and event streams (zero wall-clock, zero randomness).
import { describe, expect, it } from 'vitest';
import { AccessProjectionRuntime } from '../src/index';
import {
  allowContext,
  unwrap,
  CLIENT,
  ENGINEER,
  HOST_ADMIN,
  ROLE_CLIENT,
  ROLE_ENGINEER,
  TENANT,
  T1,
  T2,
  T3,
  sealedProgram,
  standardPolicyContent,
} from './helpers';

function drive(): AccessProjectionRuntime {
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
  const identity = { objectId: 'program:tower-retrofit', objectDigest: program.contentDigest };
  for (const [principalId, role] of [
    [CLIENT, ROLE_CLIENT],
    [ENGINEER, ROLE_ENGINEER],
  ] as const) {
    unwrap(
      host.project({
        authorization: { principalId, context: allowContext(principalId) },
        tenantId: TENANT,
        recordRef: { objectClass: 'program-of-work', ...identity },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId, principalKind: 'human', role },
        action: 'view',
        projectedAt: T3,
      }),
    );
  }
  unwrap(
    host.projectState({
      authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
      tenantId: TENANT,
      projectedAt: T3,
    }),
  );
  return host;
}

describe('determinism (two runtimes, same operations)', () => {
  it('holds byte-identical snapshots', () => {
    expect(JSON.stringify(drive().snapshot())).toBe(JSON.stringify(drive().snapshot()));
  });

  it('holds byte-identical event streams', () => {
    expect(JSON.stringify(drive().events())).toBe(JSON.stringify(drive().events()));
  });

  it('holds byte-identical audit trails', () => {
    const a = unwrap(drive().auditTrail({ tenantId: TENANT }));
    const b = unwrap(drive().auditTrail({ tenantId: TENANT }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toHaveLength(2);
  });
});
