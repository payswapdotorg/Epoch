// POLICY (positive + negative): sealing, verification, idempotent
// admission, replay-conflict, activation selection, vendor-field and
// version-skew rejections.
import { describe, expect, it } from 'vitest';
import {
  ObservabilityStore,
  selectActivePolicy,
  sealSecurityPolicy,
  verifySealedSecurityPolicy,
} from '../src/index';
import {
  OTHER_TENANT,
  POLICY_ID,
  T0,
  T1,
  TENANT,
  baselineProfile,
  baselineThresholds,
  contentOf,
  expectError,
  sealedPolicy,
  unwrap,
} from './fixtures';

describe('security policy sealing (positive)', () => {
  it('seals a well-formed policy with a canonical digest', () => {
    const sealed = sealedPolicy();
    expect(sealed.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.policyId).toBe(POLICY_ID);
    expect(sealed.status).toBe('active');
  });

  it('verifySealedSecurityPolicy round-trips the sealed record', () => {
    const sealed = sealedPolicy();
    const verified = unwrap(verifySealedSecurityPolicy(sealed));
    expect(verified.contentDigest).toBe(sealed.contentDigest);
  });

  it('seals a flavor-reordered policy (order is caller data, duplicates rejected)', () => {
    const first = unwrap(
      sealSecurityPolicy({
        ...contentOf(sealedPolicy()),
        isolation: baselineProfile({ allowedFlavors: ['declarative', 'wasm'] }),
      }),
    );
    const second = unwrap(
      sealSecurityPolicy({
        ...contentOf(sealedPolicy()),
        isolation: baselineProfile({ allowedFlavors: ['wasm', 'declarative'] }),
      }),
    );
    // Same SET of flavors, different array order: both are admitted
    // records (data order is caller choice); the canonical-order
    // refinement only rejects DUPLICATES.
    expect(first.contentDigest).not.toBe(second.contentDigest);
  });
});

describe('security policy admission (the store)', () => {
  it('admits idempotently: same digest re-admission is a no-op', () => {
    const store = new ObservabilityStore();
    const first = unwrap(store.admitPolicy(sealedPolicy()));
    expect(first.admitted).toBe(true);
    const second = unwrap(store.admitPolicy(sealedPolicy()));
    expect(second.admitted).toBe(false);
    expect(second.policy.contentDigest).toBe(first.policy.contentDigest);
  });

  it('rejects same id + different content with policy-conflict', () => {
    const store = new ObservabilityStore();
    unwrap(store.admitPolicy(sealedPolicy()));
    const error = expectError(
      store.admitPolicy(sealedPolicy({ displayName: 'tampered' })),
    );
    expect(error.code).toBe('policy-conflict');
  });

  it('selects the latest activated revision as the active policy', () => {
    const early = sealedPolicy({ revision: '1.0.0', activatedAt: T0 });
    const late = sealedPolicy({ revision: '1.1.0', activatedAt: T1 });
    expect(selectActivePolicy([early, late])?.revision).toBe('1.1.0');
    expect(selectActivePolicy([late, early])?.revision).toBe('1.1.0');
  });

  it('a retired policy never wins activation', () => {
    const active = sealedPolicy({ revision: '1.0.0', activatedAt: T0 });
    const retired = sealedPolicy({ revision: '1.1.0', activatedAt: T1, status: 'retired' });
    expect(selectActivePolicy([active, retired])?.revision).toBe('1.0.0');
    expect(selectActivePolicy([retired]) ?? null).toBeNull();
  });

  it('findActivePolicy of the store returns the latest active revision', () => {
    const store = new ObservabilityStore();
    unwrap(store.admitPolicy(sealedPolicy({ revision: '1.0.0', activatedAt: T0 })));
    unwrap(store.admitPolicy(sealedPolicy({ revision: '1.1.0', activatedAt: T1 })));
    expect(store.findActivePolicy(TENANT)?.revision).toBe('1.1.0');
  });

  it('rejects cross-tenant admission against a scoped store (R12)', () => {
    const store = new ObservabilityStore({ expectedTenantId: TENANT });
    const error = expectError(store.admitPolicy(sealedPolicy({ tenantId: OTHER_TENANT })));
    expect(error.code).toBe('cross-tenant-denied');
  });
});

describe('security policy validation (negative)', () => {
  it('rejects an unknown trust class in the isolation profile', () => {
    const error = expectError(
      sealSecurityPolicy({
        ...contentOf(sealedPolicy()),
        isolation: baselineProfile({ maxTrustClass: 't9' }),
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects duplicate flavors in the isolation profile', () => {
    const error = expectError(
      sealSecurityPolicy({
        ...contentOf(sealedPolicy()),
        isolation: baselineProfile({ allowedFlavors: ['wasm', 'wasm'] }),
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects thresholds where critical does not exceed degraded', () => {
    const error = expectError(
      sealSecurityPolicy({
        ...contentOf(sealedPolicy()),
        thresholds: baselineThresholds({
          degradedAtCriticalViolations: 2,
          criticalAtCriticalViolations: 2,
        }),
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects vendor fields (lock rule 13)', () => {
    const error = expectError(
      sealSecurityPolicy({ ...contentOf(sealedPolicy()), vendorPlan: 'siem-pro' }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('rejects a tampered digest at verification (tamper detection)', () => {
    const sealed = sealedPolicy();
    const error = expectError(
      verifySealedSecurityPolicy({ ...sealed, contentDigest: '0'.repeat(64) }),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('rejects version skew before other diagnostics', () => {
    const error = expectError(
      sealSecurityPolicy({
        ...contentOf(sealedPolicy()),
        schemaVersion: 2,
      }),
    );
    expect(error.code).toBe('validation');
  });
});
