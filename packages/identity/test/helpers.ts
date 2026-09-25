// Shared fixtures for the identity tests. Builders return loose JSON
// objects so negative tests can corrupt single fields precisely (the
// W006/W007 helpers pattern).
import {
  computeAuthenticationResultDigest,
  computePrincipalDigest,
} from '../src/index';
import type {
  AuthenticationResultRegistration,
  PrincipalRegistration,
} from '../src/index';

/** A valid human principal as loose JSON. */
export function humanPrincipal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    principalId: 'principal:ada',
    kind: 'human',
    displayName: 'Ada Lovelace',
    ...overrides,
  };
}

/** A valid agent principal as loose JSON (registered autonomous participant). */
export function agentPrincipal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    principalId: 'principal:stress-agent',
    kind: 'agent',
    displayName: 'Stress Analysis Agent',
    ...overrides,
  };
}

/** A valid service principal as loose JSON (machine client). */
export function servicePrincipal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    principalId: 'principal:ci-runner',
    kind: 'service',
    displayName: 'CI Runner',
    ...overrides,
  };
}

/** A valid credential assertion as loose JSON. */
export function assertion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    assertionId: 'assertion-0001',
    principalId: 'principal:ada',
    mechanism: 'asymmetric-key',
    assertedAt: '2026-02-01T09:15:00.000Z',
    note: 'Workstation key presentation.',
    ...overrides,
  };
}

/** A verified authentication result as loose JSON. */
export function verifiedResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    resultId: 'result-0001',
    assertionId: 'assertion-0001',
    principalId: 'principal:ada',
    outcome: 'verified',
    decidedAt: '2026-02-01T09:15:01.000Z',
    ...overrides,
  };
}

/** A failed authentication result with a typed reason. */
export function failedResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    resultId: 'result-0002',
    assertionId: 'assertion-0002',
    principalId: 'principal:ada',
    outcome: 'failed',
    reason: 'invalid-credential',
    decidedAt: '2026-02-01T09:20:00.000Z',
    ...overrides,
  };
}

/** Validate + seal a principal, throwing if invalid (fixture integrity). */
export function seal(input: Record<string, unknown>): PrincipalRegistration {
  const principal = input as unknown as PrincipalRegistration['principal'];
  return { principal, digest: computePrincipalDigest(principal) };
}

/** Seal a (possibly corrupted) principal with the digest of OTHER content. */
export function sealedWithForeignDigest(
  input: Record<string, unknown>,
): PrincipalRegistration {
  const other = seal({ ...input, displayName: 'Tampered Other Content' });
  return { principal: input as unknown as PrincipalRegistration['principal'], digest: other.digest };
}

/** Validate + seal an authentication result, throwing if invalid. */
export function sealResult(input: Record<string, unknown>): AuthenticationResultRegistration {
  const result = input as unknown as AuthenticationResultRegistration['result'];
  return { result, digest: computeAuthenticationResultDigest(result) };
}

/**
 * Wrap (possibly INVALID) principal content in an envelope with a
 * placeholder digest: admission validation runs BEFORE digest
 * verification, so the typed `validation` error is what surfaces.
 */
export function bogusSeal(input: Record<string, unknown>): PrincipalRegistration {
  return {
    principal: input as unknown as PrincipalRegistration['principal'],
    digest: 'f'.repeat(64),
  };
}

/**
 * Wrap (possibly INVALID) authentication-result content in an envelope
 * with a placeholder digest (validation runs before digest verification).
 */
export function bogusSealResult(input: Record<string, unknown>): AuthenticationResultRegistration {
  return {
    result: input as unknown as AuthenticationResultRegistration['result'],
    digest: 'f'.repeat(64),
  };
}

/** Seal an authentication result with the digest of OTHER content. */
export function sealedResultWithForeignDigest(
  input: Record<string, unknown>,
): AuthenticationResultRegistration {
  const other = sealResult({ ...input, decidedAt: '2030-01-01T00:00:00.000Z' });
  return {
    result: input as unknown as AuthenticationResultRegistration['result'],
    digest: other.digest,
  };
}
