// Positive tests: principal lifecycle, deterministic ordering, and
// authentication-result handling (verified results for active
// principals; parse round-trips; sealed evidence records).
import { describe, expect, it } from 'vitest';
import {
  PrincipalDirectory,
  parseAuthenticationResult,
  parseCredentialAssertion,
  parsePrincipal,
  parseSealedAuthenticationResult,
  parseSealedCredentialAssertion,
  sealAuthenticationResult,
  sealCredentialAssertion,
} from '../src/index';
import {
  AGENT_PRINCIPAL_ID,
  PRINCIPAL_ID,
  activeDirectoryFixture,
  assertion,
  failedResult,
  principal,
  sealResult,
  verifiedResult,
} from './helpers';

describe('principal lifecycle (positive)', () => {
  it('registers principals in the active state with every kind', () => {
    const directory = new PrincipalDirectory();
    for (const kind of ['human', 'agent', 'solver', 'robot', 'service'] as const) {
      const result = directory.register({
        principalId: `principal:fixture-${kind}`,
        kind,
        displayName: `Fixture ${kind}`,
      });
      expect(result.ok, kind).toBe(true);
      if (!result.ok) continue;
      expect(result.value.status).toBe('active');
      expect(result.value.kind).toBe(kind);
    }
    expect(directory.size).toBe(5);
  });

  it('suspends and re-activates a principal (reversible bar)', () => {
    const { directory } = activeDirectoryFixture();
    const suspended = directory.suspend(PRINCIPAL_ID);
    expect(suspended.ok && suspended.value.status).toBe('suspended');
    const reactivated = directory.activate(PRINCIPAL_ID);
    expect(reactivated.ok && reactivated.value.status).toBe('active');
  });

  it('disables a principal and re-activates it explicitly (auditable)', () => {
    const { directory } = activeDirectoryFixture();
    const disabled = directory.disable(PRINCIPAL_ID);
    expect(disabled.ok && disabled.value.status).toBe('disabled');
    const reactivated = directory.activate(PRINCIPAL_ID);
    expect(reactivated.ok && reactivated.value.status).toBe('active');
  });

  it('retrieves principals in any lifecycle state', () => {
    const { directory } = activeDirectoryFixture();
    directory.suspend(PRINCIPAL_ID);
    const suspended = directory.get(PRINCIPAL_ID);
    expect(suspended.ok && suspended.value.status).toBe('suspended');
  });

  it('listing is sorted by principalId regardless of registration order', () => {
    const forward = activeDirectoryFixture().directory;
    const reverse = new PrincipalDirectory();
    reverse.register({
      principalId: AGENT_PRINCIPAL_ID,
      kind: 'agent',
      displayName: 'Stress Analysis Agent',
    });
    reverse.register({
      principalId: PRINCIPAL_ID,
      kind: 'human',
      displayName: 'Ada Lovelace',
    });
    expect(reverse.list().map((p) => p.principalId)).toEqual(
      forward.list().map((p) => p.principalId),
    );
    expect(forward.list().map((p) => p.principalId)).toEqual([
      PRINCIPAL_ID,
      AGENT_PRINCIPAL_ID,
    ]);
  });

  it('list filters by kind and status deterministically', () => {
    const directory = new PrincipalDirectory();
    directory.register({ principalId: 'principal:a', kind: 'human', displayName: 'A' });
    directory.register({ principalId: 'principal:b', kind: 'agent', displayName: 'B' });
    directory.register({ principalId: 'principal:c', kind: 'human', displayName: 'C' });
    directory.suspend('principal:a');
    expect(directory.list({ kind: 'human' }).map((p) => p.principalId)).toEqual([
      'principal:a',
      'principal:c',
    ]);
    expect(directory.list({ status: 'suspended' }).map((p) => p.principalId)).toEqual([
      'principal:a',
    ]);
  });
});

describe('authentication-result handling (positive)', () => {
  it('a verified result for an active principal yields the verified-principal record', () => {
    const { directory } = activeDirectoryFixture();
    const verification = directory.verifyAuthentication(verifiedResult());
    expect(verification.ok).toBe(true);
    if (!verification.ok) return;
    expect(verification.value).toEqual({
      principalId: PRINCIPAL_ID,
      principal: expect.objectContaining({ displayName: 'Ada Lovelace' }),
      assertionId: 'assertion-0001',
      resultId: 'result-0001',
      verifiedAt: '2026-10-01T09:00:01.000Z',
      reasons: [{ code: 'credential-verified' }],
    });
  });

  it('a verified result with zero reasons is admitted (clean verification)', () => {
    const { directory } = activeDirectoryFixture();
    const verification = directory.verifyAuthentication(
      verifiedResult({ reasons: [] }),
    );
    expect(verification.ok).toBe(true);
  });

  it('verifyAuthentication accepts serialized documents (total surface)', () => {
    const { directory } = activeDirectoryFixture();
    const verification = directory.verifyAuthentication(
      JSON.parse(JSON.stringify(verifiedResult())) as unknown,
    );
    expect(verification.ok).toBe(true);
  });
});

describe('parse round-trips (positive)', () => {
  it('parses a valid principal', () => {
    const parsed = parsePrincipal(principal());
    expect(parsed.ok && parsed.value.principalId).toBe(PRINCIPAL_ID);
  });

  it('parses a valid credential assertion (no credential material by shape)', () => {
    const parsed = parseCredentialAssertion(assertion());
    expect(parsed.ok && parsed.value.method).toBe('knowledge');
    expect(parsed.ok && Object.keys(parsed.value).sort()).toEqual([
      'assertedAt',
      'assertionId',
      'method',
      'principalId',
      'schemaVersion',
    ]);
  });

  it('parses verified and failed authentication results', () => {
    expect(parseAuthenticationResult(verifiedResult()).ok).toBe(true);
    expect(parseAuthenticationResult(failedResult()).ok).toBe(true);
  });

  it('parses correctly sealed assertion and result records', () => {
    const sealedAssertion = sealCredentialAssertion(assertion());
    expect(sealedAssertion.ok).toBe(true);
    if (sealedAssertion.ok) {
      expect(parseSealedCredentialAssertion(sealedAssertion.value).ok).toBe(true);
    }
    const sealedResult = sealResult(verifiedResult());
    expect(parseSealedAuthenticationResult(sealedResult).ok).toBe(true);
  });

  it('sealing is key-order independent (stable digests)', () => {
    const first = sealAuthenticationResult(verifiedResult());
    const reordered = verifiedResult({
      verifiedAt: '2026-10-01T09:00:01.000Z',
      reasons: [{ code: 'credential-verified' }],
      outcome: 'verified',
      principalId: PRINCIPAL_ID,
      assertionId: 'assertion-0001',
      resultId: 'result-0001',
      schemaVersion: 1,
    });
    const second = sealAuthenticationResult(reordered);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.digest).toBe(second.value.digest);
  });
});
