// W044 Delivery-to-Learning E2E fixture — the shared INVARIANT LIBRARY.
//
// The cross-cutting assertions the fixture composes (the W031
// tests/e2e/test/helpers.ts pattern, extended for the W040-W043 error
// surfaces this fixture crosses):
//
//   - TENANT ISOLATION at every boundary crossing (typed error shapes)
//   - PROVENANCE CHAINS verify (W006 digests: recompute + compare)
//   - REPLAY DETERMINISM (run the scenario twice in-process:
//     byte-identical state digests)
//   - ROUND-TRIP: the digest projection serializes + digest-verifies
//   - AUTHORITY ROUTING negatives (kernels reject direct-state writes)
//   - PROVIDER-VOCABULARY containment (the Aurum adapter seam)
//
// Every helper is assertion-only: no scenario logic lives here (the
// scenario DEFINITION is examples/delivery-e2e/scenarios/*).
import { expect } from 'vitest';
import { canonicalDigest, type JsonValue } from '@epoch/action-policy';

// --------------------------------------------------------------------------------
// Result helpers (the kernels' total-result discipline).
// --------------------------------------------------------------------------------

/** Unwrap a total result, failing the test with the typed error on red. */
export function unwrap<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } },
  label = 'kernel result',
): T {
  if (!result.ok) {
    throw new Error(`${label} failed (${result.error.code}): ${result.error.message}`);
  }
  return result.value;
}

/** Assert a total result is red with the exact typed error code. */
export function expectError<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } },
  code: string,
  label = 'kernel result',
): void {
  if (result.ok) {
    throw new Error(`${label}: expected the typed error "${code}", got ok`);
  }
  expect(result.error.code, `${label}: expected error code "${code}"`).toBe(code);
}

// --------------------------------------------------------------------------------
// Tenant isolation (R12) — the typed cross-tenant denial shapes.
// --------------------------------------------------------------------------------

/** The typed shape of a cross-tenant denial. */
interface CrossTenantError {
  readonly code: string;
  readonly message: string;
  readonly expectedTenantId?: string;
  readonly encounteredTenantId?: string;
}

/** Assert a red result is the typed cross-tenant denial with both tenants. */
export function expectCrossTenantDenied(
  result: { ok: true; value: unknown } | { ok: false; error: CrossTenantError },
  expectedTenantId: string,
  encounteredTenantId: string,
  label = 'cross-tenant gate',
): void {
  if (result.ok) {
    throw new Error(`${label}: expected a cross-tenant denial, got ok`);
  }
  expect(result.error.code, `${label}: error code`).toBe('cross-tenant-denied');
  expect(result.error.expectedTenantId, `${label}: expectedTenantId`).toBe(expectedTenantId);
  expect(result.error.encounteredTenantId, `${label}: encounteredTenantId`).toBe(encounteredTenantId);
}

/** The tenant-isolation variant (the W040/W041/W042/W043 kernels' name). */
export function expectTenantIsolationRejected(
  result: { ok: true; value: unknown } | { ok: false; error: CrossTenantError },
  expectedTenantId: string,
  encounteredTenantId: string,
  label = 'tenant isolation gate',
): void {
  if (result.ok) {
    throw new Error(`${label}: expected a tenant-isolation rejection, got ok`);
  }
  expect(result.error.code, `${label}: error code`).toBe('tenant-isolation-rejected');
  expect(result.error.expectedTenantId, `${label}: expectedTenantId`).toBe(expectedTenantId);
  expect(result.error.encounteredTenantId, `${label}: encounteredTenantId`).toBe(encounteredTenantId);
}

// --------------------------------------------------------------------------------
// Provenance chains (W006) — recompute + compare.
// --------------------------------------------------------------------------------

/**
 * Assert a digest-bearing record's claimed digest equals the recomputed
 * digest over its content (the universal W006 discipline).
 */
export function expectDigestVerifies(
  content: unknown,
  claimedDigest: string,
  label = 'sealed record',
): void {
  expect(claimedDigest, `${label}: digest shape`).toMatch(/^[0-9a-f]{64}$/);
  const recomputed = canonicalDigest(content as JsonValue);
  expect(claimedDigest, `${label}: claimed digest matches the recomputed content digest`).toBe(recomputed);
}

/**
 * Assert a hash chain lines up: each link's parent reference equals the
 * previous link's digest, and the first link's parent is null.
 */
export function expectChainLinks(
  digests: readonly string[],
  parentOf: (index: number) => string | null,
  label = 'digest chain',
): void {
  for (const [index, digest] of digests.entries()) {
    expect(digest, `${label}: link ${index} digest shape`).toMatch(/^[0-9a-f]{64}$/);
    const expectedParent = index === 0 ? null : digests[index - 1]!;
    expect(parentOf(index), `${label}: link ${index} parent`).toBe(expectedParent);
  }
}

// --------------------------------------------------------------------------------
// Replay determinism — run twice, byte-identical digests.
// --------------------------------------------------------------------------------

/**
 * The determinism gate: run the scenario twice in-process and require
 * the two digest projections to canonically digest IDENTICALLY.
 */
export function expectScenarioDeterministic<S>(
  run: () => S,
  projection: (scenario: S) => Record<string, string | readonly string[]>,
  label = 'scenario',
): { readonly first: S; readonly second: S } {
  const first = run();
  const second = run();
  const firstDigest = canonicalDigest(projection(first) as JsonValue);
  const secondDigest = canonicalDigest(projection(second) as JsonValue);
  expect(secondDigest, `${label}: two in-process runs produce byte-identical derived digests`).toBe(firstDigest);
  return { first, second };
}

// --------------------------------------------------------------------------------
// Round-trip: the digest projection serializes + digest-verifies.
// --------------------------------------------------------------------------------

/**
 * The round-trip gate: a scenario projection must be JSON-serializable
 * and its serialization must digest stably.
 */
export function expectRoundTrip(
  projection: Record<string, string | readonly string[]>,
  label = 'scenario projection',
): string {
  const serialized = JSON.stringify(projection);
  expect(serialized.length, `${label}: serializes to non-empty JSON`).toBeGreaterThan(0);
  const roundTripped = JSON.parse(serialized) as Record<string, unknown>;
  expect(canonicalDigest(roundTripped as JsonValue), `${label}: digest survives the round trip`).toBe(
    canonicalDigest(projection as JsonValue),
  );
  return canonicalDigest(projection as JsonValue);
}

// --------------------------------------------------------------------------------
// Provider-vocabulary containment (the W042 Aurum adapter seam).
// --------------------------------------------------------------------------------

/**
 * The provider tokens that must NEVER cross the adapter seam into a
 * neutral-seam value (the Aurum chat adapter's own neutrality
 * discipline — the provider's names and vocabulary).
 */
export const PROVIDER_VOCABULARY: readonly string[] = [
  'aurum',
  'messageId',
  'threadId',
  'channel-site-ops',
  'user-field-lead',
  'slack',
  'teams',
  'discord',
  'whatsapp',
];

/** Assert no provider token appears in the serialized neutral value. */
export function expectNoProviderVocabulary(value: unknown, label = 'neutral seam value'): void {
  const serialized = JSON.stringify(value).toLowerCase();
  const hits: string[] = [];
  for (const token of PROVIDER_VOCABULARY) {
    const pattern = new RegExp(`\\b${token.replace(/[-\s]/g, (m) => (m === '-' ? '\\-' : '\\s'))}\\b`);
    if (pattern.test(serialized)) {
      hits.push(token);
    }
  }
  expect(hits, `${label}: no provider vocabulary leaks past the adapter seam`).toEqual([]);
}

// --------------------------------------------------------------------------------
// Authority routing — no fixture path writes a kernel's authoritative
// state directly (the kernels' own negative-path exports).
// --------------------------------------------------------------------------------

/** The typed shape of an authority-routing negative error. */
interface AuthorityError {
  readonly code: string;
  readonly message: string;
}

/** Assert a red result carries one of the authority-routing error codes. */
export function expectAuthorityRoutingRejected(
  result: { ok: true; value: unknown } | { ok: false; error: AuthorityError },
  expectedCode: string,
  label = 'authority routing gate',
): void {
  if (result.ok) {
    throw new Error(`${label}: expected the typed rejection "${expectedCode}", got ok`);
  }
  expect(result.error.code, `${label}: error code`).toBe(expectedCode);
}
