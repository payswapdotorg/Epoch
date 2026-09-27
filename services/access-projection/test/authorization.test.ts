// The W009 authorization gate: unauthorized operations are denied
// BEFORE any kernel admission (fail-closed; zero state created), and
// every gated operation passes the same seam.
import { describe, expect, it } from 'vitest';
import { AccessProjectionRuntime } from '../src/index';
import {
  allowContext,
  expectError,
  unwrap,
  CLIENT,
  HOST_ADMIN,
  inactivePrincipalContext,
  unknownPrincipalContext,
  ROLE_CLIENT,
  TENANT,
  T1,
  T2,
  T3,
  sealedProgram,
  standardPolicyContent,
} from './helpers';

describe('the authorization gate (W009, fail-closed)', () => {
  it('an UNKNOWN principal is authorization-rejected (unknown-principal denial)', () => {
    const host = new AccessProjectionRuntime();
    const error = expectError(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: unknownPrincipalContext() },
        policy: standardPolicyContent(),
        registeredAt: T1,
      }),
      'authorization-rejected',
    );
    expect(error.denialCode).toBe('unknown-principal');
    expect(host.health().policyRevisionCount).toBe(0);
  });

  it('an INACTIVE principal is authorization-rejected (inactive-principal)', () => {
    const host = new AccessProjectionRuntime();
    const error = expectError(
      host.admitRecord({
        authorization: { principalId: HOST_ADMIN, context: inactivePrincipalContext(HOST_ADMIN) },
        record: sealedProgram(),
        admittedAt: T1,
      }),
      'authorization-rejected',
    );
    expect(error.denialCode).toBe('inactive-principal');
    expect(host.health().recordCount).toBe(0);
  });

  it('a projection for an unauthorized principal is rejected before evaluation', () => {
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
    const error = expectError(
      host.project({
        authorization: { principalId: CLIENT, context: unknownPrincipalContext() },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: 'program:tower-retrofit',
          objectDigest: 'x'.repeat(64),
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'view',
        projectedAt: T3,
      }),
      'authorization-rejected',
    );
    expect(error.denialCode).toBe('unknown-principal');
    // Zero state was created by the denied operation.
    expect(host.health().auditCount).toBe(0);
    expect(host.health().projectionCount).toBe(0);
  });

  it('the state projection passes the gate too', () => {
    const host = new AccessProjectionRuntime();
    expectError(
      host.projectState({
        authorization: { principalId: HOST_ADMIN, context: unknownPrincipalContext() },
        tenantId: TENANT,
        projectedAt: T3,
      }),
      'authorization-rejected',
    );
  });

  it('the full flow is green when authorized (the gate admits real W009 allows)', () => {
    const host = new AccessProjectionRuntime();
    unwrap(
      host.registerPolicy({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        policy: standardPolicyContent(),
        registeredAt: T1,
      }),
    );
    const record = unwrap(
      host.admitRecord({
        authorization: { principalId: HOST_ADMIN, context: allowContext(HOST_ADMIN) },
        record: sealedProgram(),
        admittedAt: T2,
      }),
    );
    expect(record.kind).toBe('record-admitted');
    expect(host.health().recordCount).toBe(1);
  });
});
