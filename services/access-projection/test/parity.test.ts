// Runtime parity: every host event is admitted by the REAL W010
// sealEvent and digests identically through the REAL computeEventDigest
// (the devDependency parity discipline — never a runtime edge), and the
// events cover the whole access-projection vocabulary over the flow.
import { describe, expect, it } from 'vitest';
import { computeEventDigest, sealEvent } from '@epoch/event-log';
import { ACCESS_PROJECTION_EVENT_DISCRIMINATORS } from '@epoch/access-projection';
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

describe('W010 parity (host events seal through the REAL sealEvent)', () => {
  it('every host event is admitted by the REAL sealEvent and digests identically', () => {
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
    unwrap(
      host.project({
        authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: 'program:tower-retrofit',
          objectDigest: program.contentDigest,
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'view',
        projectedAt: T3,
      }),
    );
    // An export denial for the client (view-only row) exercises the
    // projection-denied + second audit events.
    unwrap(
      host.project({
        authorization: { principalId: ENGINEER, context: allowContext(ENGINEER) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: 'program:tower-retrofit',
          objectDigest: program.contentDigest,
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: ENGINEER, principalKind: 'human', role: ROLE_ENGINEER },
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

    const events = host.events();
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      const { contentDigest, ...content } = event;
      const theirs = unwrap(sealEvent(content));
      expect(theirs.digest).toBe(contentDigest);
      expect(computeEventDigest(content)).toBe(contentDigest);
    }
  });

  it('the events cover the whole released-vocabulary subset over the flow', () => {
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
    // A successful view (released) …
    unwrap(
      host.project({
        authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: 'program:tower-retrofit',
          objectDigest: program.contentDigest,
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'view',
        projectedAt: T3,
      }),
    );
    // … and an export denial for the same view-only row.
    unwrap(
      host.project({
        authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: 'program:tower-retrofit',
          objectDigest: program.contentDigest,
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'export',
        projectedAt: T3,
      }),
    );
    const discriminators = new Set(host.events().map((event) => event.payload.discriminator));
    for (const expected of [
      'access-projection:policy-registered',
      'access-projection:record-admitted',
      'access-projection:projection-released',
      'access-projection:projection-denied',
      'access-projection:audit-recorded',
    ]) {
      expect(discriminators.has(expected), expected).toBe(true);
    }
    // Every discriminator is a member of the closed kernel vocabulary.
    for (const discriminator of discriminators) {
      expect((ACCESS_PROJECTION_EVENT_DISCRIMINATORS as readonly string[]).includes(discriminator)).toBe(true);
    }
  });

  it('each target owns exactly one stream (object, policy, tenant state)', () => {
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
    unwrap(
      host.project({
        authorization: { principalId: CLIENT, context: allowContext(CLIENT) },
        tenantId: TENANT,
        recordRef: {
          objectClass: 'program-of-work',
          objectId: 'program:tower-retrofit',
          objectDigest: program.contentDigest,
        },
        policyRef: { policyId: 'policy:tower-retrofit-access', revision: 1 },
        subject: { principalId: CLIENT, principalKind: 'human', role: ROLE_CLIENT },
        action: 'view',
        projectedAt: T3,
      }),
    );
    expect(host.snapshot().streamCount).toBe(2); // policy stream + object stream
  });
});
