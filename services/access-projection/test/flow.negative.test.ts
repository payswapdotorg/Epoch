// The negative host flow: tenant isolation (R12), unknown references,
// malformed inputs, and the fail-closed store guard.
import { describe, expect, it } from 'vitest';
import { AccessProjectionRuntime } from '../src/index';
import {
  allowContext,
  expectError,
  unwrap,
  CLIENT,
  HOST_ADMIN,
  OTHER_TENANT,
  ROLE_CLIENT,
  TENANT,
  T1,
  T2,
  T3,
  sealedProgram,
  standardPolicyContent,
} from './helpers';

describe('tenant isolation (R12)', () => {
  it('a host pinned to one tenant rejects foreign tenants (tenant-isolation-rejected)', () => {
    const host = new AccessProjectionRuntime({ expectedTenantId: TENANT });
    // A policy of the OTHER tenant: the single-tenant guard fires BEFORE
    // any authorization or admission.
    const foreignPolicy = {
      ...standardPolicyContent(),
      tenantId: OTHER_TENANT,
    };
    const error = expectError(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN, OTHER_TENANT) },
        policy: foreignPolicy,
        registeredAt: T1,
      }),
      'tenant-isolation-rejected',
    );
    expect(error.expectedTenantId).toBe(TENANT);
    expect(error.encounteredTenantId).toBe(OTHER_TENANT);
    expect(host.health().tenantCount).toBe(0);
  });

  it('a pinned host rejects a foreign-tenant RECORD before admission (tenant-isolation-rejected)', () => {
    const host = new AccessProjectionRuntime({ expectedTenantId: TENANT });
    const foreignRecord = sealedProgram(OTHER_TENANT);
    expectError(
      host.admitRecord({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN, OTHER_TENANT) },
        record: foreignRecord,
        admittedAt: T1,
      }),
      'tenant-isolation-rejected',
    );
    expect(host.health().recordCount).toBe(0);
  });
});

describe('unknown references (fail-closed)', () => {
  function loadedHost() {
    const host = new AccessProjectionRuntime();
    unwrap(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        policy: standardPolicyContent(),
        registeredAt: T1,
      }),
    );
    unwrap(
      host.admitRecord({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        record: sealedProgram(),
        admittedAt: T2,
      }),
    );
    return host;
  }

  it('projecting an unadmitted record is unknown-record', () => {
    const host = loadedHost();
    const error = expectError(
      host.project({
        authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: 'program:never-admitted',
          objectDigest: 'f'.repeat(64),
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'view',
        projectedAt: T3,
      }),
      'unknown-record',
    );
    expect(error.objectId).toBe('program:never-admitted');
    expect(host.health().auditCount).toBe(0);
  });

  it('projecting under an unregistered policy revision is unknown-policy', () => {
    const host = loadedHost();
    const program = sealedProgram();
    expectError(
      host.project({
        authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: 'program:tower-retrofit',
          objectDigest: program.contentDigest,
        },
        policyRef: { policyId: 'policy:never-registered', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'view',
        projectedAt: T3,
      }),
      'unknown-policy',
    );
  });

  it('projecting against an empty tenant is unknown-store', () => {
    const host = new AccessProjectionRuntime();
    expectError(
      host.project({
        authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: 'program:tower-retrofit',
          objectDigest: 'f'.repeat(64),
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'view',
        projectedAt: T3,
      }),
      'unknown-store',
    );
  });
});

describe('malformed inputs (typed validation)', () => {
  it('a record without a canonical schema discriminator is rejected', () => {
    const host = new AccessProjectionRuntime();
    expectError(
      host.admitRecord({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        record: { schema: 'some.other.schema' },
        admittedAt: T1,
      }),
      'validation',
    );
  });

  it('a policy without a tenant scope is rejected', () => {
    const host = new AccessProjectionRuntime();
    expectError(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        policy: { schema: 'epoch.access-projection.policy' },
        registeredAt: T1,
      }),
      'validation',
    );
  });

  it('a malformed authorization context is a typed validation error', () => {
    const host = new AccessProjectionRuntime();
    expectError(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: { schemaVersion: 99 } as never },
        policy: standardPolicyContent(),
        registeredAt: T1,
      }),
      'validation',
    );
  });
});
