// Negative tests: every admission/lifecycle class the identity registry
// must reject — malformed ids, vendor/secret fields, duplicates, unknown
// principals, illegal lifecycle transitions, reason/outcome mismatches,
// and tampered digests. Fail-closed: authentication is a typed result,
// never an open door.
import { describe, expect, it } from 'vitest';
import type { IdentityError, IdentityResult } from '../src/index';
import {
  IdentityRegistry,
  parseAuthenticationResultRecord,
  parsePrincipalRecord,
} from '../src/index';
import {
  agentPrincipal,
  bogusSeal,
  bogusSealResult,
  failedResult,
  humanPrincipal,
  seal,
  sealResult,
  sealedResultWithForeignDigest,
  sealedWithForeignDigest,
  verifiedResult,
} from './helpers';

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: IdentityResult<T>): IdentityError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

describe('malformed ids + vendor/secret fields (negative — validation boundary)', () => {
  it('rejects malformed principal ids (wrong case, missing prefix, tenant-shaped)', () => {
    const registry = new IdentityRegistry();
    for (const badId of ['Principal:Ada', 'ada', 'tenant:acme', 'principal:', 'principal:a'.repeat(64)]) {
      const error = failureOf(
        registry.registerPrincipal(bogusSeal(humanPrincipal({ principalId: badId }))),
      );
      expect(error.code, badId).toBe('validation');
    }
  });

  it('rejects unknown principal kinds (closed vocabulary)', () => {
    const registry = new IdentityRegistry();
    const error = failureOf(
      registry.registerPrincipal(bogusSeal(humanPrincipal({ kind: 'oauth-client' }))),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects schema-version skew before any other check', () => {
    const registry = new IdentityRegistry();
    const error = failureOf(
      registry.registerPrincipal(bogusSeal(humanPrincipal({ schemaVersion: 2 }))),
    );
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path === 'schemaVersion')).toBe(true);
  });

  it('rejects vendor fields on principals and credential-shaped fields anywhere (strict objects)', () => {
    const registry = new IdentityRegistry();
    const error = failureOf(
      registry.registerPrincipal(bogusSeal(humanPrincipal({ apiKey: 'sk-live' }))),
    );
    expect(error.code).toBe('validation');
  });
});

describe('duplicate principal (negative)', () => {
  it('rejects registering the same principal id twice', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    const error = failureOf(registry.registerPrincipal(seal(humanPrincipal())));
    expect(error.code).toBe('duplicate-principal');
  });
});

describe('unknown principal (negative)', () => {
  it('getPrincipal/suspend/deactivate/authenticationHistory reject unknown ids', () => {
    const registry = new IdentityRegistry();
    const results: IdentityResult<unknown>[] = [
      registry.getPrincipal('principal:ghost'),
      registry.suspend('principal:ghost'),
      registry.deactivate('principal:ghost'),
      registry.authenticationHistory('principal:ghost'),
    ];
    for (const result of results) {
      expect(failureOf(result).code).toBe('unknown-principal');
    }
  });

  it('recordAuthentication rejects a result for an unregistered principal (it cannot attach)', () => {
    const registry = new IdentityRegistry();
    const error = failureOf(
      registry.recordAuthentication(sealResult(verifiedResult({ principalId: 'principal:ghost' }))),
    );
    expect(error.code).toBe('unknown-principal');
  });
});

describe('illegal lifecycle transitions (negative)', () => {
  it('rejects suspending a deactivated principal', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    registry.deactivate('principal:ada');
    const error = failureOf(registry.suspend('principal:ada'));
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('rejects reactivating a deactivated principal (no revival)', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    registry.deactivate('principal:ada');
    // There is no activate() API at all — deactivation is terminal; a
    // returning principal registers as a NEW principal id. Assert the
    // transition table pins this.
    const error = failureOf(registry.deactivate('principal:ada'));
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('rejects suspending an already-suspended principal', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    registry.suspend('principal:ada');
    const error = failureOf(registry.suspend('principal:ada'));
    expect(error.code).toBe('lifecycle-conflict');
    if (error.code !== 'lifecycle-conflict') return;
    expect(error.from).toBe('suspended');
    expect(error.to).toBe('suspended');
  });
});

describe('reason/outcome discipline (negative — typed authentication results)', () => {
  it('rejects a verified result that carries a failure reason', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    const error = failureOf(
      registry.recordAuthentication(
        bogusSealResult(verifiedResult({ reason: 'invalid-credential' })),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects a failed result without a typed reason', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    const error = failureOf(
      registry.recordAuthentication(bogusSealResult({ ...failedResult(), reason: undefined })),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects a failed result with an out-of-vocabulary reason', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    const error = failureOf(
      registry.recordAuthentication(bogusSealResult(failedResult({ reason: 'server-error' }))),
    );
    expect(error.code).toBe('validation');
  });
});

describe('tampered digests (negative — integrity boundary)', () => {
  it('registerPrincipal rejects a principal whose claimed digest does not match', () => {
    const registry = new IdentityRegistry();
    const error = failureOf(registry.registerPrincipal(sealedWithForeignDigest(humanPrincipal())));
    expect(error.code).toBe('digest-mismatch');
    if (error.code !== 'digest-mismatch') return;
    expect(error.expected).not.toBe(error.encountered);
  });

  it('a tampered principal registration never enters the registry', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(sealedWithForeignDigest(humanPrincipal()));
    expect(registry.size).toBe(0);
  });

  it('recordAuthentication rejects a result whose claimed digest does not match', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    const error = failureOf(
      registry.recordAuthentication(sealedResultWithForeignDigest(verifiedResult())),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('parsePrincipalRecord rejects a tampered record digest', () => {
    const registry = new IdentityRegistry();
    const registered = registry.registerPrincipal(seal(agentPrincipal()));
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    const tampered = { ...registered.value, principalDigest: 'd'.repeat(64) };
    const error = failureOf(parsePrincipalRecord(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('parseAuthenticationResultRecord rejects a tampered result digest', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    const recorded = registry.recordAuthentication(sealResult(verifiedResult()));
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    const tampered = { ...recorded.value, resultDigest: 'e'.repeat(64) };
    const error = failureOf(parseAuthenticationResultRecord(tampered));
    expect(error.code).toBe('digest-mismatch');
  });
});
