// W030 — NEGATIVE EVIDENCE: fail-closed admission, isolation
// violations, cross-tenant denials, tampered digests, and the
// authority-conflict guard.
import { describe, expect, it } from 'vitest';
import { SecurityRuntime } from '@epoch/security-runtime';
import {
  BAD_EXTENSION_ID,
  EXTENSION_ID,
  LISTING_ID,
  OTHER_TENANT,
  PRINCIPAL,
  TENANT,
  T1,
  T2,
  baselinePolicyContent,
  conformingSubject,
  officerAuth,
  sealedListing,
  violatingSubject,
} from '../scenarios/security-scenario';

describe('the W030 negative evidence (fail-closed everywhere)', () => {
  it('a foreign principal cannot operate the security surface (W009 gate)', () => {
    const runtime = new SecurityRuntime();
    const foreign = {
      principalId: 'principal:foreign-engineer',
      context: {
        schemaVersion: 1 as const,
        principals: [
          { principalId: 'principal:foreign-engineer', status: 'active' as const, authenticated: true },
        ],
        memberships: [{ principalId: 'principal:foreign-engineer', tenantId: OTHER_TENANT }],
        knownTenants: [TENANT, OTHER_TENANT],
      },
    };
    const rejected = runtime.registerPolicy({
      tenantId: TENANT,
      authorization: foreign,
      policy: baselinePolicyContent(),
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe('authorization-rejected');
      expect((rejected.error as { denialCode?: string }).denialCode).toBe('cross-tenant-denied');
    }
  });

  it('the single-tenant host rejects foreign tenants (R12)', () => {
    const runtime = new SecurityRuntime({ expectedTenantId: TENANT });
    const rejected = runtime.registerPolicy({
      tenantId: OTHER_TENANT,
      authorization: officerAuth(),
      policy: baselinePolicyContent(),
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('tenant-isolation-rejected');
  });

  it('the violating subject is rejected with the typed violation list + auto-quarantine', () => {
    const runtime = new SecurityRuntime();
    const auth = officerAuth();
    expect(
      runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: baselinePolicyContent() }).ok,
    ).toBe(true);
    const rejected = runtime.admitExtension({
      tenantId: TENANT,
      authorization: auth,
      subject: violatingSubject(),
      admittedAt: T1,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe('isolation-violation');
      expect((rejected.error as unknown as { violations: Array<{ code: string }> }).violations.map((v) => v.code)).toEqual([
        'trust-class-exceeds-ceiling',
        'flavor-not-admitted',
        'data-handling-not-admitted',
      ]);
    }
    // The quarantined subject is denied-by-default afterwards.
    const denied = runtime.admitExtension({
      tenantId: TENANT,
      authorization: auth,
      subject: conformingSubject({ extensionId: BAD_EXTENSION_ID }),
      admittedAt: T2,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('quarantined-subject-rejected');
  });

  it('a tampered listing digest never registers (the REAL W023 verifier)', () => {
    const runtime = new SecurityRuntime();
    const sealed = sealedListing() as { contentDigest: string };
    const tampered = { ...sealed, contentDigest: '0'.repeat(64) };
    const rejected = runtime.registerListing({
      tenantId: TENANT,
      authorization: officerAuth(),
      listing: tampered,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('listing-verification-rejected');
  });

  it('an unregistered listing under a listing-requiring profile is fail-closed', () => {
    const runtime = new SecurityRuntime();
    const auth = officerAuth();
    const policy = baselinePolicyContent();
    (policy as { isolation: Record<string, unknown> }).isolation = {
      ...(policy as { isolation: Record<string, unknown> }).isolation,
      requireMarketplaceListing: true,
    };
    (policy as { revision: string }).revision = '1.1.0';
    expect(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy }).ok).toBe(true);
    const rejected = runtime.admitExtension({
      tenantId: TENANT,
      authorization: auth,
      subject: conformingSubject({ listingId: LISTING_ID }),
      admittedAt: T1,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('unknown-listing');
  });

  it('no ACTIVE policy means no admission (fail-closed)', () => {
    const runtime = new SecurityRuntime();
    const rejected = runtime.admitExtension({
      tenantId: TENANT,
      authorization: officerAuth(),
      subject: conformingSubject(),
      admittedAt: T1,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('unknown-policy');
  });

  it('a grant exceeding the W008 trust-class ceiling is a typed violation (the REAL table)', () => {
    const runtime = new SecurityRuntime();
    const auth = officerAuth();
    expect(
      runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: baselinePolicyContent() }).ok,
    ).toBe(true);
    // A t1 subject requesting capability.invoke (a t2 ceiling
    // function): the kernel AND the REAL W008 authority both flag it.
    const rejected = runtime.admitExtension({
      tenantId: TENANT,
      authorization: auth,
      subject: conformingSubject({
        trustClass: 't1',
        grants: [
          {
            capabilityId: 'capability:terrain-render',
            hostFunctions: ['capability.invoke'],
            resourceScopes: [],
          },
        ],
      }),
      admittedAt: T1,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe('isolation-violation');
      expect(
        (rejected.error as unknown as { violations: Array<{ code: string }> }).violations.some(
          (v) => v.code === 'grant-exceeds-trust-ceiling',
        ),
      ).toBe(true);
    }
    void EXTENSION_ID;
    void PRINCIPAL;
  });
});
