// NEGATIVE EVIDENCE: fail-closed admission, isolation violations,
// listing failures, idempotency conflicts, tamper detection, and the
// quarantined-subject / policy-inactive traps.
import { describe, expect, it } from 'vitest';
import { sealListingVersion } from '@epoch/marketplace';
import { SecurityRuntime } from '../src/index';
import {
  EXTENSION_ID,
  EXTENSION_ID_2,
  LISTING_ID,
  OTHER_TENANT,
  PRINCIPAL,
  SOURCE_DIGEST,
  TENANT,
  T1,
  T2,
  allowAuth,
  baselineProfile,
  conformingSubject,
  expectError,
  listingContent,
  policyContent,
  unwrap,
} from './helpers';
import type { AuthorizationContext } from '@epoch/authorization';

describe('sandbox admission (fail-closed negatives)', () => {
  it('no ACTIVE policy -> fail-closed unknown-policy (never open admission)', () => {
    const runtime = new SecurityRuntime();
    const error = expectError(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: allowAuth(),
        subject: conformingSubject(),
        admittedAt: T1,
      }),
    );
    expect(error.code).toBe('unknown-policy');
  });

  it('a tenant whose ONLY policy is retired is fail-closed (no active policy)', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(
      runtime.registerPolicy({
        tenantId: TENANT,
        authorization: auth,
        policy: policyContent({ status: 'retired' }),
      }),
    );
    const error = expectError(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject(),
        admittedAt: T1,
      }),
    );
    expect(error.code).toBe('unknown-policy');
  });

  it('a retired revision never wins activation over an active one', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(
      runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }),
    );
    unwrap(
      runtime.registerPolicy({
        tenantId: TENANT,
        authorization: auth,
        policy: policyContent({ revision: '1.1.0', status: 'retired', activatedAt: T1 }),
      }),
    );
    // The ACTIVE 1.0.0 stays in force: admission succeeds under it.
    const admitted = unwrap(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject(),
        admittedAt: T2,
      }),
    );
    expect(admitted.verdict.verdict).toBe('conforms');
  });

  it('isolation violations reject admission (typed violation list) and quarantine', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
    const error = expectError(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject({ trustClass: 't4', flavor: 'remote' }),
        admittedAt: T1,
      }),
    );
    expect(error.code).toBe('isolation-violation');
    const violations = (error as unknown as { violations: Array<{ code: string }> }).violations;
    expect(violations.map((v) => v.code)).toEqual([
      'trust-class-exceeds-ceiling',
      'flavor-not-admitted',
    ]);
    // Policy-driven quarantine: the violation quarantined the subject.
    const state = unwrap(
      runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T1 }),
    );
    expect(state.quarantinedSubjects).toEqual([EXTENSION_ID]);
  });

  it('a malformed subject is a typed validation failure (the W008-mirrored shape)', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
    const error = expectError(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: { ...conformingSubject(), vendorSandbox: 'gvisor' },
        admittedAt: T1,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('a subject over the profile ceiling (t3 max t2) is rejected even with legal grants', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
    const error = expectError(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject({ extensionId: EXTENSION_ID_2, trustClass: 't3' }),
        admittedAt: T1,
      }),
    );
    expect(error.code).toBe('isolation-violation');
    expect(
      (error as unknown as { violations: Array<{ code: string }> }).violations.map((v) => v.code),
    ).toEqual(['trust-class-exceeds-ceiling']);
  });
});

describe('marketplace listing provenance (W023 negatives)', () => {
  it('a tampered listing digest is rejected by the REAL marketplace verifier', () => {
    const runtime = new SecurityRuntime();
    const sealed = unwrap(sealListingVersion(listingContent()));
    const error = expectError(
      runtime.registerListing({
        tenantId: TENANT,
        authorization: allowAuth(),
        listing: { ...sealed, contentDigest: '0'.repeat(64) },
      }),
    );
    expect(error.code).toBe('listing-verification-rejected');
  });

  it('a foreign developer tenant is rejected (R12)', () => {
    const runtime = new SecurityRuntime();
    const error = expectError(
      runtime.registerListing({
        tenantId: TENANT,
        authorization: allowAuth(),
        listing: listingContent({ developerTenantId: 'tenant:initech' }),
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('same listing id + different content is a listing-conflict', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(
      runtime.registerListing({ tenantId: TENANT, authorization: auth, listing: listingContent() }),
    );
    const error = expectError(
      runtime.registerListing({
        tenantId: TENANT,
        authorization: auth,
        listing: listingContent({ displayName: 'Different content' }),
      }),
    );
    expect(error.code).toBe('listing-conflict');
  });

  it('a profile requiring listings rejects an UNREGISTERED listing (fail-closed)', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(
      runtime.registerPolicy({
        tenantId: TENANT,
        authorization: auth,
        policy: policyContent({
          revision: '1.1.0',
          isolation: {
            ...baselineProfile(),
            requireMarketplaceListing: true,
          },
          activatedAt: T1,
        }),
      }),
    );
    const error = expectError(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject({ listingId: LISTING_ID }),
        admittedAt: T2,
      }),
    );
    expect(error.code).toBe('unknown-listing');
  });

  it('a REGISTERED listing satisfies the provenance requirement', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(
      runtime.registerPolicy({
        tenantId: TENANT,
        authorization: auth,
        policy: policyContent({
          revision: '1.1.0',
          isolation: {
            ...baselineProfile(),
            requireMarketplaceListing: true,
          },
          activatedAt: T1,
        }),
      }),
    );
    unwrap(
      runtime.registerListing({ tenantId: TENANT, authorization: auth, listing: listingContent() }),
    );
    const admitted = unwrap(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject({ listingId: LISTING_ID }),
        admittedAt: T2,
      }),
    );
    expect(admitted.verdict.verdict).toBe('conforms');
  });
});

describe('idempotency + admission conflicts', () => {
  it('policy re-registration with the SAME digest is idempotent', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    const first = unwrap(
      runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }),
    );
    expect(first.registered).toBe(true);
    const second = unwrap(
      runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }),
    );
    expect(second.registered).toBe(false);
  });

  it('listing re-registration with the SAME digest is idempotent', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    const first = unwrap(
      runtime.registerListing({ tenantId: TENANT, authorization: auth, listing: listingContent() }),
    );
    expect(first.registered).toBe(true);
    const second = unwrap(
      runtime.registerListing({ tenantId: TENANT, authorization: auth, listing: listingContent() }),
    );
    expect(second.registered).toBe(false);
  });

  it('observation intake is idempotent by id + digest', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    const options = {
      tenantId: TENANT,
      authorization: auth,
      observationId: 'observation:invocation-001',
      extensionId: EXTENSION_ID,
      outcome: 'allowed' as const,
      observedAt: T1,
      sourceDigest: SOURCE_DIGEST,
    };
    unwrap(runtime.observeSandboxInvocation(options));
    const replay = unwrap(runtime.observeSandboxInvocation(options));
    expect(replay.observationId).toBe('observation:invocation-001');
    const trail = unwrap(
      runtime.readAuditTrail({ tenantId: TENANT, authorization: auth, subjectId: EXTENSION_ID }),
    );
    expect(trail).toHaveLength(1);
  });

  it('the same observation id with DIFFERENT content is a duplicate-observation rejection', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(
      runtime.observeSandboxInvocation({
        tenantId: TENANT,
        authorization: auth,
        observationId: 'observation:invocation-001',
        extensionId: EXTENSION_ID,
        outcome: 'allowed',
        observedAt: T1,
        sourceDigest: SOURCE_DIGEST,
      }),
    );
    const error = expectError(
      runtime.observeSandboxInvocation({
        tenantId: TENANT,
        authorization: auth,
        observationId: 'observation:invocation-001',
        extensionId: EXTENSION_ID,
        outcome: 'denied',
        observedAt: T2,
        sourceDigest: SOURCE_DIGEST,
      }),
    );
    expect(error.code).toBe('duplicate-observation');
  });
});

describe('the quarantine lifecycle traps', () => {
  it('double imposition is a quarantine-conflict', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(
      runtime.imposeQuarantine({
        tenantId: TENANT,
        authorization: auth,
        quarantineId: 'quarantine:ext-001',
        subjectKind: 'extension',
        subjectId: EXTENSION_ID,
        reason: 'first',
        actedAt: T1,
      }),
    );
    const error = expectError(
      runtime.imposeQuarantine({
        tenantId: TENANT,
        authorization: auth,
        quarantineId: 'quarantine:ext-001-again',
        subjectKind: 'extension',
        subjectId: EXTENSION_ID,
        reason: 'second',
        actedAt: T2,
      }),
    );
    expect(error.code).toBe('quarantine-conflict');
  });

  it('releasing a non-quarantined subject is quarantine-release-rejected (no silent no-op)', () => {
    const runtime = new SecurityRuntime();
    const error = expectError(
      runtime.releaseQuarantine({
        tenantId: TENANT,
        authorization: allowAuth(),
        quarantineId: 'quarantine:ext-001',
        subjectId: EXTENSION_ID,
        reason: 'nothing to release',
        actedAt: T1,
      }),
    );
    expect(error.code).toBe('quarantine-release-rejected');
  });

  it('cross-tenant stream reads are denied (R12)', () => {
    // An UNSCOPED host serves two tenants; a tenant-A read of a
    // tenant-B subject stream is the typed cross-tenant denial.
    const runtime = new SecurityRuntime();
    const authA = allowAuth();
    const authB = { principalId: PRINCIPAL, context: allowContextB() };
    unwrap(
      runtime.observeTenantBoundary({
        tenantId: OTHER_TENANT,
        authorization: authB,
        observationId: 'observation:boundary-b-001',
        subjectId: OTHER_TENANT,
        subjectTenantId: OTHER_TENANT,
        actorTenantId: OTHER_TENANT,
        outcome: 'denied',
        observedAt: T1,
        sourceDigest: SOURCE_DIGEST,
      }),
    );
    const error = expectError(
      runtime.readStream({
        tenantId: TENANT,
        authorization: authA,
        streamId: 'stream:security-initech',
      }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  function allowContextB(): AuthorizationContext {
    return {
      schemaVersion: 1,
      principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
      memberships: [{ principalId: PRINCIPAL, tenantId: OTHER_TENANT }],
      knownTenants: [OTHER_TENANT],
    };
  }
});
