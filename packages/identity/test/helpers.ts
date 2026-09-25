// Shared fixtures for the identity tests. Builders return loose JSON
// objects so negative tests can corrupt single fields precisely (the
// W006/W007 helpers pattern).
import { PrincipalDirectory, computeAuthenticationResultDigest } from '../src/index';
import type {
  AuthenticationResult,
  Principal,
  SealedAuthenticationResult,
} from '../src/index';

export const PRINCIPAL_ID = 'principal:ada-lovelace';
export const AGENT_PRINCIPAL_ID = 'principal:stress-agent';
export const OTHER_PRINCIPAL_ID = 'principal:grace-hopper';

/** A valid human principal as loose JSON. */
export function principal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    principalId: PRINCIPAL_ID,
    kind: 'human',
    status: 'active',
    displayName: 'Ada Lovelace',
    ...overrides,
  };
}

/** A valid agent principal as loose JSON. */
export function agentPrincipal(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    principalId: AGENT_PRINCIPAL_ID,
    kind: 'agent',
    status: 'active',
    displayName: 'Stress Analysis Agent',
    ...overrides,
  };
}

/** A valid credential assertion as loose JSON (no credential material). */
export function assertion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    assertionId: 'assertion-0001',
    principalId: PRINCIPAL_ID,
    method: 'knowledge',
    assertedAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

/** A verified authentication result as loose JSON. */
export function verifiedResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    resultId: 'result-0001',
    assertionId: 'assertion-0001',
    principalId: PRINCIPAL_ID,
    outcome: 'verified',
    verifiedAt: '2026-10-01T09:00:01.000Z',
    reasons: [{ code: 'credential-verified' }],
    ...overrides,
  };
}

/** A failed authentication result as loose JSON (typed reasons). */
export function failedResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    resultId: 'result-0002',
    assertionId: 'assertion-0002',
    principalId: PRINCIPAL_ID,
    outcome: 'failed',
    verifiedAt: '2026-10-01T09:05:00.000Z',
    reasons: [
      { code: 'credential-invalid', detail: 'The asserted credential did not verify.' },
    ],
    ...overrides,
  };
}

/** Seal a (possibly corrupted) result, throwing if invalid (fixture integrity). */
export function sealResult(resultInput: Record<string, unknown>): SealedAuthenticationResult {
  const result = resultInput as unknown as AuthenticationResult;
  return { result, digest: computeAuthenticationResultDigest(result) };
}

/** Seal a result with the digest of OTHER content (tampered envelope). */
export function sealedWithForeignDigest(
  resultInput: Record<string, unknown>,
): SealedAuthenticationResult {
  const other = sealResult(
    verifiedResult({ ...(resultInput as { resultId: string }), resultId: 'other' }),
  );
  return { result: resultInput as unknown as AuthenticationResult, digest: other.digest };
}

/** A registered, active directory fixture with two principals. */
export function activeDirectoryFixture(): {
  directory: PrincipalDirectory;
  ada: Principal;
} {
  const directory = new PrincipalDirectory();
  const ada = directory.register({
    principalId: PRINCIPAL_ID,
    kind: 'human',
    displayName: 'Ada Lovelace',
  });
  if (!ada.ok) throw new Error('fixture principal registration failed');
  const agent = directory.register({
    principalId: AGENT_PRINCIPAL_ID,
    kind: 'agent',
    displayName: 'Stress Analysis Agent',
  });
  if (!agent.ok) throw new Error('fixture agent registration failed');
  return { directory, ada: ada.value };
}
