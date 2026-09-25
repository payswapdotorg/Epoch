// Negative tests: every boundary the identity package must reject —
// named for the W009 acceptance criteria. Every rejection is a TYPED
// error value (never a throw, never a silent accept): the
// principal-inactive security boundary (suspended and disabled
// principals NEVER authenticate), authentication-failed with typed
// reasons, unknown-principal, duplicate-principal, lifecycle-conflict,
// validation (malformed ids, vendor/provider fields, credential
// material shapes), and digest-mismatch (tamper detection).
import { describe, expect, it } from 'vitest';
import type { IdentityError, IdentityResult } from '../src/index';
import {
  parseAuthenticationResult,
  parseCredentialAssertion,
  parsePrincipal,
  parseSealedAuthenticationResult,
} from '../src/index';
import {
  PRINCIPAL_ID,
  activeDirectoryFixture,
  assertion,
  failedResult,
  principal,
  sealedWithForeignDigest,
  verifiedResult,
} from './helpers';

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: IdentityResult<T>): IdentityError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

describe('principal-inactive (negative — the security boundary)', () => {
  it('rejects authentication for a suspended principal even on a verified result', () => {
    const { directory } = activeDirectoryFixture();
    directory.suspend(PRINCIPAL_ID);
    const error = failureOf(directory.verifyAuthentication(verifiedResult()));
    expect(error.code).toBe('principal-inactive');
    if (error.code !== 'principal-inactive') return;
    expect(error.status).toBe('suspended');
    expect(error.principalId).toBe(PRINCIPAL_ID);
  });

  it('rejects authentication for a disabled principal even on a verified result', () => {
    const { directory } = activeDirectoryFixture();
    directory.disable(PRINCIPAL_ID);
    const error = failureOf(directory.verifyAuthentication(verifiedResult()));
    expect(error.code).toBe('principal-inactive');
    if (error.code !== 'principal-inactive') return;
    expect(error.status).toBe('disabled');
  });

  it('a suspended-then-activated principal authenticates again (explicit transition)', () => {
    const { directory } = activeDirectoryFixture();
    directory.suspend(PRINCIPAL_ID);
    expect(directory.verifyAuthentication(verifiedResult()).ok).toBe(false);
    directory.activate(PRINCIPAL_ID);
    expect(directory.verifyAuthentication(verifiedResult()).ok).toBe(true);
  });
});

describe('authentication-failed (negative)', () => {
  it('a failed result surfaces as a typed error carrying the record reasons', () => {
    const { directory } = activeDirectoryFixture();
    const error = failureOf(directory.verifyAuthentication(failedResult()));
    expect(error.code).toBe('authentication-failed');
    if (error.code !== 'authentication-failed') return;
    expect(error.reasons).toEqual([
      { code: 'credential-invalid', detail: 'The asserted credential did not verify.' },
    ]);
  });

  it('a failed result for an UNKNOWN principal reports unknown-principal first', () => {
    const { directory } = activeDirectoryFixture();
    const error = failureOf(
      directory.verifyAuthentication(failedResult({ principalId: 'principal:ghost' })),
    );
    expect(error.code).toBe('unknown-principal');
  });
});

describe('unknown-principal / duplicate-principal (negative)', () => {
  it('verifyAuthentication rejects a result for an unregistered principal', () => {
    const { directory } = activeDirectoryFixture();
    const error = failureOf(
      directory.verifyAuthentication(verifiedResult({ principalId: 'principal:ghost' })),
    );
    expect(error.code).toBe('unknown-principal');
  });

  it('get rejects an unknown principal id', () => {
    const { directory } = activeDirectoryFixture();
    expect(failureOf(directory.get('principal:ghost')).code).toBe('unknown-principal');
  });

  it('register rejects a duplicate principal id (lifecycle, not re-registration)', () => {
    const { directory } = activeDirectoryFixture();
    const error = failureOf(
      directory.register({
        principalId: PRINCIPAL_ID,
        kind: 'human',
        displayName: 'Ada Lovelace (again)',
      }),
    );
    expect(error.code).toBe('duplicate-principal');
  });
});

describe('lifecycle-conflict (negative)', () => {
  it('rejects suspending a suspended principal (no self-transitions)', () => {
    const { directory } = activeDirectoryFixture();
    directory.suspend(PRINCIPAL_ID);
    const error = failureOf(directory.suspend(PRINCIPAL_ID));
    expect(error.code).toBe('lifecycle-conflict');
    if (error.code !== 'lifecycle-conflict') return;
    expect(error.from).toBe('suspended');
    expect(error.to).toBe('suspended');
  });

  it('rejects transitions for unknown principals', () => {
    const { directory } = activeDirectoryFixture();
    for (const result of [
      directory.suspend('principal:ghost'),
      directory.disable('principal:ghost'),
      directory.activate('principal:ghost'),
    ]) {
      expect(failureOf(result).code).toBe('unknown-principal');
    }
  });

  it('the transition table is pinned (no state outside the table is legal)', () => {
    const { directory } = activeDirectoryFixture();
    directory.disable(PRINCIPAL_ID);
    // disabled -> disabled is illegal (explicit re-activation required).
    const error = failureOf(directory.disable(PRINCIPAL_ID));
    expect(error.code).toBe('lifecycle-conflict');
  });
});

describe('malformed documents (negative — validation)', () => {
  it('rejects malformed principal ids', () => {
    for (const badId of [
      '',
      'principal',
      'principal:',
      'Principal:Ada',
      'principal:Ada',
      'principal:ada lovelace',
      'principal:a%b',
      `principal:${'x'.repeat(64)}`,
      'user:ada',
    ]) {
      const error = failureOf(parsePrincipal(principal({ principalId: badId })));
      expect(error.code, JSON.stringify(badId)).toBe('validation');
    }
  });

  it('rejects unknown principal kinds and statuses', () => {
    expect(failureOf(parsePrincipal(principal({ kind: 'llm' }))).code).toBe('validation');
    expect(failureOf(parsePrincipal(principal({ kind: 'openai-agent' }))).code).toBe(
      'validation',
    );
    expect(failureOf(parsePrincipal(principal({ status: 'banned' }))).code).toBe(
      'validation',
    );
  });

  it('rejects vendor/provider fields on principal documents (strict objects)', () => {
    const withVendor = principal({ provider: 'auth0', domain: 'example.com' });
    const error = failureOf(parsePrincipal(withVendor));
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path === 'provider')).toBe(true);
    expect(error.issues.some((issue) => issue.path === 'domain')).toBe(true);
  });

  it('rejects credential MATERIAL on assertion documents (no secrets/tokens)', () => {
    // Even provider-neutral secret-looking fields never enter the
    // contract: the assertion descriptor is closed by strictObject.
    const withSecret = assertion({ secret: 'hunter2', token: 'eyJhbGciOi...' });
    const error = failureOf(parseCredentialAssertion(withSecret));
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path === 'secret')).toBe(true);
    expect(error.issues.some((issue) => issue.path === 'token')).toBe(true);
  });

  it('rejects vendor credential methods (factor classes only)', () => {
    expect(failureOf(parseCredentialAssertion(assertion({ method: 'oauth2' }))).code).toBe(
      'validation',
    );
    expect(failureOf(parseCredentialAssertion(assertion({ method: 'oidc' }))).code).toBe(
      'validation',
    );
    expect(failureOf(parseCredentialAssertion(assertion({ method: 'api-key' }))).code).toBe(
      'validation',
    );
  });

  it('rejects a failed result without reasons (auditability refinement)', () => {
    const error = failureOf(parseAuthenticationResult(failedResult({ reasons: [] })));
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path === 'reasons')).toBe(true);
  });

  it('rejects malformed timestamps and unknown reason codes', () => {
    expect(
      failureOf(parseCredentialAssertion(assertion({ assertedAt: '2026-10-01T09:00:00Z' })))
        .code,
    ).toBe('validation');
    expect(
      failureOf(parseCredentialAssertion(assertion({ assertedAt: 'not-a-time' }))).code,
    ).toBe('validation');
    expect(
      failureOf(
        parseAuthenticationResult(verifiedResult({ reasons: [{ code: 'meh' }] })),
      ).code,
    ).toBe('validation');
  });

  it('rejects version skew', () => {
    expect(failureOf(parsePrincipal(principal({ schemaVersion: 2 }))).code).toBe(
      'validation',
    );
    expect(
      failureOf(parseAuthenticationResult(verifiedResult({ schemaVersion: 3 }))).code,
    ).toBe('validation');
  });
});

describe('digest-mismatch (negative — tamper detection)', () => {
  it('parseSealedAuthenticationResult rejects a tampered result record', () => {
    const tampered = sealedWithForeignDigest(verifiedResult());
    const error = failureOf(parseSealedAuthenticationResult(tampered));
    expect(error.code).toBe('digest-mismatch');
    if (error.code !== 'digest-mismatch') return;
    expect(error.expected).not.toBe(error.encountered);
  });
});
