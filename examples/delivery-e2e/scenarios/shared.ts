// W044 Delivery-to-Learning E2E fixture — shared scenario vocabulary.
//
// The scenario DEFINITION lives in examples/delivery-e2e (importable,
// documented); the named fixture TEST lives in tests/delivery-e2e/test.
// This module holds the vocabulary the scenario shares: tenants,
// principals, the fixed instant series, and the uncertainty builders
// every W036-bearing record needs.
//
// DETERMINISM DISCIPLINE (the E2E philosophy, see docs/e2e/README.md and
// docs/delivery-e2e/README.md): zero wall-clock reads, zero randomness,
// zero network. Every instant is a producer-supplied constant; every
// digest is derived from content. Two runs of the scenario in the same
// process (or any process) produce byte-identical state digests.

/** The home tenant of the delivery-to-learning fixture (W009 grammar). */
export const TENANT = 'tenant:globex' as const;

/** The foreign tenant used by every cross-tenant negative path (W009 grammar). */
export const OTHER_TENANT = 'tenant:initech' as const;

/** The delivery-domain principals of the fixture (W009 grammar). */
export const PRINCIPAL = 'principal:delivery-lead' as const;
export const OBSERVER = 'principal:field-engineer' as const;
export const APPROVER = 'principal:chief-engineer' as const;
export const PROCUREMENT = 'principal:procurement-lead' as const;
export const FOREMAN = 'principal:site-foreman' as const;
export const SUPERVISOR = 'principal:delivery-supervisor' as const;

/** The access-projection principals (W041 roles). */
export const CLIENT_VIEWER = 'principal:client-viewer' as const;
export const SITE_ENGINEER = 'principal:site-engineer' as const;
export const ROLE_CLIENT = 'role:client-viewer' as const;
export const ROLE_ENGINEER = 'role:site-engineer' as const;

/** The external-event-bridge operator (the W042 reference operator). */
export const BRIDGE_OPERATOR = 'principal:chat-relay' as const;

/**
 * The fixed instant series of the delivery-to-learning fixture
 * (ISO-8601, UTC, one-hour steps). Callers supply these to every kernel
 * API that wants an instant; the scenario never reads a clock.
 */
export const T = [
  '2026-06-01T08:00:00.000Z', // T0  — existing conditions reconstructed
  '2026-06-01T09:00:00.000Z', // T1  — alternatives authored
  '2026-06-01T10:00:00.000Z', // T2  — alternatives evaluated / solution sealed
  '2026-06-01T11:00:00.000Z', // T3  — baseline approved / programme built / delivery opened
  '2026-06-01T12:00:00.000Z', // T4  — acquisition requested / field work starts
  '2026-06-01T13:00:00.000Z', // T5  — quote submitted / supervisor request issued
  '2026-06-01T14:00:00.000Z', // T6  — selection decided / field observation made
  '2026-06-01T15:00:00.000Z', // T7  — commitment / forecast r1
  '2026-06-01T16:00:00.000Z', // T8  — purchase order / forecast r2
  '2026-06-01T17:00:00.000Z', // T9  — supplier delivery / supervision pass 1 (missed milestone)
  '2026-06-01T18:00:00.000Z', // T10 — Aurum answer returned / actualization / variance
  '2026-06-01T19:00:00.000Z', // T11 — supervision pass 2 (automatic update) / alert escalation
  '2026-06-01T20:00:00.000Z', // T12 — verification / outcome
  '2026-06-01T21:00:00.000Z', // T13 — close
  '2026-06-01T22:00:00.000Z', // T14 — learning dataset / model revision
  '2026-06-01T23:00:00.000Z', // T15 — projections (learning state, access views)
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
    freshness: { state: 'fresh', assessedAt: T[4] },
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

/** One valid W036 uncertainty state with reported provenance (external acquisition). */
export function reportedUncertainty(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return uncertainty({
    provenance: { kind: 'reported', sourceRef: 'source:external-event-bridge', actor: BRIDGE_OPERATOR },
    confidence: { method: 'imported', value: 0.8, rationale: 'reported through the external event bridge' },
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

/**
 * Unwrap a total kernel result, failing LOUDLY with the typed error.
 * Scenario builders fail loudly on impossible admissions — a red result
 * in the happy path is a scenario bug, never a silent skip.
 */
export function need<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } },
  label: string,
): T {
  if (!result.ok) {
    throw new Error(`delivery-learning scenario: ${label} failed (${result.error.code}): ${result.error.message} ${JSON.stringify(result.error)}`);
  }
  return result.value;
}
