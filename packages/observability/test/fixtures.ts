// Shared fixtures for the @epoch/observability kernel tests. Builders
// return loose JSON objects so negative tests can corrupt single
// fields precisely. ZERO clock reads. W008 sandbox subjects are built
// over the MIRRORED W008 vocabulary (the parity tests feed the REAL
// extension-runtime shapes).
import { sealObservation, sealSecurityPolicy, type SealedObservation, type SealedSecurityPolicy } from '../src/index';

export const T0 = '2026-03-02T09:00:00.000Z';
export const T1 = '2026-03-02T09:00:01.000Z';
export const T2 = '2026-03-02T09:00:02.000Z';
export const T3 = '2026-03-02T09:00:03.000Z';
export const T4 = '2026-03-02T09:00:04.000Z';
export const T5 = '2026-03-02T09:00:05.000Z';
export const T6 = '2026-03-02T09:00:06.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:security-officer';
export const ACTOR_PRINCIPAL = 'principal:field-engineer';
export const POLICY_ID = 'security-policy:globex-baseline';
export const EXTENSION_ID = 'extension:terrain-viewer';
export const EXTENSION_ID_2 = 'extension:weather-wasm';
export const SESSION_ID = 'session:earthworks-orchestration';
export const SIMRUN_ID = 'simrun:excavation-model';
export const ACTION_ID = 'action:dispatch-excavator';
export const OBSERVATION_ID = 'observation:ext-admission-001';
export const QUARANTINE_ID = 'quarantine:ext-terrain-001';
export const SOURCE_DIGEST = 'a'.repeat(64);
export const SOURCE_DIGEST_2 = 'b'.repeat(64);
export const LISTING_ID = 'listing:terrain-viewer';

/** Strip the digest off a sealed record (spreadable CONTENT for tests). */
export function contentOf<T extends { contentDigest: string }>(
  sealed: T,
): Omit<T, 'contentDigest'> {
  const { contentDigest: _digest, ...content } = sealed;
  void _digest;
  return content;
}

/** Unwrap a total result or fail loudly (positive-path helper). */
export function unwrap<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Assert a typed error code (negative-path helper). */
export function expectError<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): { readonly code: string; readonly message: string } {
  if (result.ok) {
    throw new Error(`expected a typed rejection, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error as { code: string; message: string };
}

/** The canonical baseline isolation profile (loose JSON; overrides applied last). */
export function baselineProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    maxTrustClass: 't2',
    allowedFlavors: ['declarative', 'wasm'],
    allowedDataHandling: ['sandbox-only', 'tenant-scoped'],
    requireMarketplaceListing: false,
    quarantineOnViolation: true,
    ...overrides,
  };
}

/** The canonical baseline thresholds. */
export function baselineThresholds(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    degradedAtCriticalViolations: 1,
    criticalAtCriticalViolations: 2,
    ...overrides,
  };
}

/** The sealed baseline security policy (loose content; overrides applied last). */
export function sealedPolicy(overrides: Record<string, unknown> = {}): SealedSecurityPolicy {
  return unwrap(
    sealSecurityPolicy({
      schema: 'epoch.observability.security-policy',
      schemaVersion: 1,
      policyId: POLICY_ID,
      tenantId: TENANT,
      revision: '1.0.0',
      displayName: 'Globex baseline security policy',
      isolation: baselineProfile(),
      thresholds: baselineThresholds(),
      status: 'active',
      activatedAt: T0,
      activatedBy: PRINCIPAL,
      ...overrides,
    }),
  );
}

/** The conforming sandbox subject (loose JSON; overrides applied last). */
export function conformingSubject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    extensionId: EXTENSION_ID,
    extensionVersion: '1.2.0',
    extensionManifestDigest: SOURCE_DIGEST,
    flavor: 'wasm',
    trustClass: 't2',
    bindings: [{ capabilityId: 'capability:terrain-render' }],
    grants: [
      {
        capabilityId: 'capability:terrain-render',
        hostFunctions: ['world.read', 'log.write'],
        resourceScopes: [{ resource: 'world', access: 'read' }],
      },
    ],
    dataHandling: 'sandbox-only',
    ...overrides,
  };
}

/** The sealed conforming admission observation (loose content; overrides applied last). */
export function sealedAdmissionObservation(
  overrides: Record<string, unknown> = {},
): SealedObservation {
  return unwrap(
    sealObservation({
      schema: 'epoch.observability.observation',
      schemaVersion: 1,
      observationId: OBSERVATION_ID,
      tenantId: TENANT,
      subjectKind: 'extension',
      subjectId: EXTENSION_ID,
      observationClass: 'sandbox-admission',
      outcome: 'allowed',
      severity: 'notice',
      actor: PRINCIPAL,
      provenance: { sourceDigest: SOURCE_DIGEST },
      observedAt: T1,
      detail: { violationCount: 0 },
      ...overrides,
    }),
  );
}

/** The sealed violation observation (loose content; overrides applied last). */
export function sealedViolationObservation(
  id: string,
  overrides: Record<string, unknown> = {},
): SealedObservation {
  return unwrap(
    sealObservation({
      schema: 'epoch.observability.observation',
      schemaVersion: 1,
      observationId: id,
      tenantId: TENANT,
      subjectKind: 'extension',
      subjectId: EXTENSION_ID,
      observationClass: 'sandbox-violation',
      outcome: 'violated',
      severity: 'critical',
      actor: PRINCIPAL,
      provenance: { sourceDigest: SOURCE_DIGEST_2 },
      observedAt: T2,
      detail: { violationCode: 'grant-exceeds-trust-ceiling' },
      ...overrides,
    }),
  );
}

/** The sealed tenant-boundary observation (loose content; overrides applied last). */
export function sealedBoundaryObservation(
  id: string,
  overrides: Record<string, unknown> = {},
): SealedObservation {
  return unwrap(
    sealObservation({
      schema: 'epoch.observability.observation',
      schemaVersion: 1,
      observationId: id,
      tenantId: TENANT,
      subjectKind: 'tenant',
      subjectId: TENANT,
      observationClass: 'tenant-boundary-check',
      outcome: 'denied',
      severity: 'warning',
      actor: ACTOR_PRINCIPAL,
      provenance: { sourceDigest: SOURCE_DIGEST },
      observedAt: T3,
      detail: { subjectTenantId: TENANT, actorTenantId: OTHER_TENANT },
      ...overrides,
    }),
  );
}
