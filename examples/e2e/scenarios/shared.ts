// W031 Reference E2E slices — shared scenario vocabulary.
//
// The scenario DEFINITIONS live in examples/e2e (importable, documented);
// the named slice TESTS live in tests/e2e/test. This module holds the
// vocabulary every scenario shares: tenants, principals, a fixed instant
// series, and the uncertainty builder every W036-bearing record needs.
//
// DETERMINISM DISCIPLINE (the E2E philosophy, see docs/e2e/README.md):
// zero wall-clock reads, zero randomness, zero network. Every instant is a
// producer-supplied constant; every digest is derived from content. Two
// runs of any scenario in the same process (or any process) produce
// byte-identical state digests.

/** The home tenant of every reference scenario (W009 grammar). */
export const TENANT = 'tenant:globex' as const;

/** The foreign tenant used by every cross-tenant negative path (W009 grammar). */
export const OTHER_TENANT = 'tenant:initech' as const;

/** The delivery-domain principals of the reference scenarios (W009 grammar). */
export const PRINCIPAL = 'principal:delivery-lead' as const;
export const OBSERVER = 'principal:field-engineer' as const;
export const APPROVER = 'principal:chief-engineer' as const;
export const PROCUREMENT = 'principal:procurement-lead' as const;
export const FOREMAN = 'principal:site-foreman' as const;
export const PLATFORM_ENGINEER = 'principal:platform-engineer' as const;
export const CHIEF_ARCHITECT = 'principal:chief-architect' as const;

/**
 * The fixed instant series of the reference scenarios (ISO-8601, UTC,
 * one-hour steps). Callers supply these to every kernel API that wants an
 * instant; the scenarios never read a clock.
 */
export const T = [
  '2026-05-04T08:00:00.000Z', // T0  — solution authored
  '2026-05-04T09:00:00.000Z', // T1  — solution sealed / programme built
  '2026-05-04T10:00:00.000Z', // T2  — baseline approved / delivery opened
  '2026-05-04T11:00:00.000Z', // T3  — acquisition requested / field work starts
  '2026-05-04T12:00:00.000Z', // T4  — quote submitted / observation made
  '2026-05-04T13:00:00.000Z', // T5  — selection decided / acceptance
  '2026-05-04T14:00:00.000Z', // T6  — commitment / actualization
  '2026-05-04T15:00:00.000Z', // T7  — purchase order / forecast r1
  '2026-05-04T16:00:00.000Z', // T8  — supplier delivery / forecast r2
  '2026-05-04T17:00:00.000Z', // T9  — variance computed / supervision fold
  '2026-05-04T18:00:00.000Z', // T10 — approvals / action decisions
  '2026-05-04T19:00:00.000Z', // T11 — action execution / outcome records
  '2026-05-05T08:00:00.000Z', // T12 — approval deadline horizon
] as const;

/** A deterministic 64-char lowercase-hex digest (fixture convention). */
export const DIGEST = (char: string): string => char.repeat(64);

/** One valid W036 uncertainty state (observed provenance, fresh, measured). */
export function uncertainty(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:site-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T[3] },
    confidence: { method: 'measured', value: 0.95, rationale: 'direct field measurement' },
    ...overrides,
  };
}

/** One valid W036 uncertainty state with derived provenance (model output). */
export function derivedUncertainty(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return uncertainty({
    provenance: { kind: 'derived', sourceRef: 'source:delivery-pipeline' },
    confidence: { method: 'derived', value: 0.9, rationale: 'derived from accepted actuals' },
    ...overrides,
  });
}

/**
 * A minimal W002-shaped world-entity view for the pack projections
 * (id + type key; the packs accept these as `worldEntities` inputs).
 */
export function worldEntitiesOf(
  entries: readonly { readonly id: string; readonly type: string }[],
): readonly { readonly id: string; readonly type: string }[] {
  return [...entries].sort((a, b) => (a.id < b.id ? -1 : 1));
}
