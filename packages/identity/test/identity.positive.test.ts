// Positive tests: the material identity behaviors — principal lifecycle,
// authentication-result handling (verified/failed with typed reasons),
// digest-checked admission, deterministic ordering, and record
// round-trips.
import { describe, expect, it } from 'vitest';
import {
  IdentityRegistry,
  parseAuthenticationResultRecord,
  parseCredentialAssertion,
  parsePrincipalRecord,
  sealAuthenticationResult,
  sealPrincipal,
} from '../src/index';
import {
  agentPrincipal,
  assertion,
  failedResult,
  humanPrincipal,
  seal,
  sealResult,
  servicePrincipal,
  verifiedResult,
} from './helpers';

describe('principal lifecycle (positive)', () => {
  it('registers a sealed principal in the active state', () => {
    const registry = new IdentityRegistry();
    const result = registry.registerPrincipal(seal(humanPrincipal()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lifecycle).toBe('active');
    expect(result.value.principal.principalId).toBe('principal:ada');
  });

  it('suspends an active principal (advisory hold)', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    const suspended = registry.suspend('principal:ada');
    expect(suspended.ok).toBe(true);
    if (!suspended.ok) return;
    expect(suspended.value.lifecycle).toBe('suspended');
  });

  it('deactivates a suspended principal (terminal)', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    registry.suspend('principal:ada');
    const deactivated = registry.deactivate('principal:ada');
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok) return;
    expect(deactivated.value.lifecycle).toBe('deactivated');
  });

  it('deactivating an active principal directly is legal (immediate yank)', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    const deactivated = registry.deactivate('principal:ada');
    expect(deactivated.ok).toBe(true);
  });

  it('lifecycle transitions never rewrite the content digest', () => {
    const registry = new IdentityRegistry();
    const registered = registry.registerPrincipal(seal(humanPrincipal()));
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    registry.suspend('principal:ada');
    const suspended = registry.getPrincipal('principal:ada');
    expect(suspended.ok).toBe(true);
    if (!suspended.ok) return;
    expect(suspended.value.principalDigest).toBe(registered.value.principalDigest);
  });

  it('listPrincipals is sorted by principal id regardless of registration order', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(servicePrincipal()));
    registry.registerPrincipal(seal(agentPrincipal()));
    registry.registerPrincipal(seal(humanPrincipal()));
    expect(registry.listPrincipals().map((record) => record.principal.principalId)).toEqual([
      'principal:ada',
      'principal:ci-runner',
      'principal:stress-agent',
    ]);
  });

  it('listPrincipals filters by kind and lifecycle deterministically', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    registry.registerPrincipal(seal(agentPrincipal()));
    registry.suspend('principal:stress-agent');
    expect(
      registry.listPrincipals({ kind: 'agent' }).map((record) => record.lifecycle),
    ).toEqual(['suspended']);
    expect(
      registry.listPrincipals({ lifecycle: 'active' }).map((record) => record.principal.principalId),
    ).toEqual(['principal:ada']);
  });
});

describe('authentication-result handling (positive)', () => {
  it('records a verified result (no reason) and a failed result (typed reason)', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    const verified = registry.recordAuthentication(sealResult(verifiedResult()));
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.value.result.outcome).toBe('verified');
    const failed = registry.recordAuthentication(
      sealResult(failedResult({ resultId: 'result-0003' })),
    );
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    expect(failed.value.result.outcome).toBe('failed');
    expect(failed.value.result.reason).toBe('invalid-credential');
  });

  it('authentication history is sorted by (decidedAt, resultId) regardless of recording order', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    // Record out of chronological order on purpose.
    registry.recordAuthentication(
      sealResult(failedResult({ resultId: 'result-late', decidedAt: '2026-02-01T10:00:00.000Z' })),
    );
    registry.recordAuthentication(sealResult(verifiedResult()));
    const history = registry.authenticationHistory('principal:ada');
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.value.map((record) => record.result.resultId)).toEqual([
      'result-0001',
      'result-late',
    ]);
  });

  it('latestAuthentication returns the newest result, or null when none exists', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    expect(registry.latestAuthentication('principal:ada')).toEqual({ ok: true, value: null });
    registry.recordAuthentication(sealResult(verifiedResult()));
    registry.recordAuthentication(
      sealResult(failedResult({ resultId: 'result-late', decidedAt: '2026-02-01T10:00:00.000Z' })),
    );
    const latest = registry.latestAuthentication('principal:ada');
    expect(latest.ok).toBe(true);
    if (!latest.ok) return;
    expect(latest.value?.result.resultId).toBe('result-late');
  });

  it('credential assertions parse as published descriptors', () => {
    const parsed = parseCredentialAssertion(assertion());
    expect(parsed.ok).toBe(true);
  });

  it('records round-trip through parse (digests verified)', () => {
    const registry = new IdentityRegistry();
    registry.registerPrincipal(seal(humanPrincipal()));
    registry.recordAuthentication(sealResult(verifiedResult()));
    const principal = registry.getPrincipal('principal:ada');
    expect(principal.ok).toBe(true);
    if (!principal.ok) return;
    const parsedPrincipal = parsePrincipalRecord(principal.value);
    expect(parsedPrincipal.ok).toBe(true);
    const history = registry.authenticationHistory('principal:ada');
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    const parsedResult = parseAuthenticationResultRecord(history.value[0]!);
    expect(parsedResult.ok).toBe(true);
  });
});

describe('sealing helpers (positive)', () => {
  it('sealPrincipal and sealAuthenticationResult are total; key order never matters', () => {
    const sealed = sealPrincipal(humanPrincipal());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const reordered = sealPrincipal({
      displayName: 'Ada Lovelace',
      kind: 'human',
      principalId: 'principal:ada',
      schemaVersion: 1,
    });
    expect(reordered.ok).toBe(true);
    if (!reordered.ok) return;
    expect(sealed.value.digest).toBe(reordered.value.digest);

    const sealedResult = sealAuthenticationResult(verifiedResult());
    expect(sealedResult.ok).toBe(true);
  });
});
