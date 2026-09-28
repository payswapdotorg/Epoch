// Shared fixtures for the security-runtime service tests. Builders
// return loose JSON objects so negative tests can corrupt single
// fields precisely. ZERO clock reads. The authorization contexts are
// REAL @epoch/authorization shapes (W009); the W041 projection
// pipeline fixtures use the REAL @epoch/access-projection evaluation
// (devDependency parity — never a runtime edge).
import type { AuthorizationContext } from '@epoch/authorization';
import { evaluate } from '@epoch/authorization';
import type { AuthorizationDecision, AuthorizationRequest } from '@epoch/authorization';

export const T0 = '2026-03-02T09:00:00.000Z';
export const T1 = '2026-03-02T09:00:01.000Z';
export const T2 = '2026-03-02T09:00:02.000Z';
export const T3 = '2026-03-02T09:00:03.000Z';
export const T4 = '2026-03-02T09:00:04.000Z';
export const T5 = '2026-03-02T09:00:05.000Z';
export const T6 = '2026-03-02T09:00:06.000Z';
export const T7 = '2026-03-02T09:00:07.000Z';
export const T8 = '2026-03-02T09:00:08.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:security-officer';
export const DENIED_PRINCIPAL = 'principal:site-engineer';
export const POLICY_ID = 'security-policy:globex-baseline';
export const EXTENSION_ID = 'extension:terrain-viewer';
export const EXTENSION_ID_2 = 'extension:weather-wasm';
export const LISTING_ID = 'listing:terrain-viewer';
export const SESSION_ID = 'session:earthworks-orchestration';
export const SIMRUN_ID = 'simrun:excavation-model';
export const ACTION_ID = 'action:dispatch-excavator';
export const SOURCE_DIGEST = 'a'.repeat(64);
export const SOURCE_DIGEST_2 = 'b'.repeat(64);
export const MANIFEST_DIGEST = 'c'.repeat(64);

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

/** A REAL W009 authorization context that allows `principalId` in `tenantId`. */
export function allowContext(principalId: string, tenantId: string = TENANT): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: 'active', authenticated: true }],
    memberships: [{ principalId, tenantId }],
    knownTenants: [tenantId],
  };
}

/** A REAL W009 context whose principal is unknown (deny: unknown-principal). */
export function unknownPrincipalContext(tenantId: string = TENANT): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [],
    memberships: [],
    knownTenants: [tenantId],
  };
}

/** A REAL W009 context whose membership is in a foreign tenant (deny: cross-tenant-denied). */
export function foreignMembershipContext(principalId: string): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: 'active', authenticated: true }],
    memberships: [{ principalId, tenantId: OTHER_TENANT }],
    knownTenants: [TENANT, OTHER_TENANT],
  };
}

/** The caller-supplied authorization input of the allowed principal. */
export function allowAuth(principalId: string = PRINCIPAL): {
  principalId: string;
  context: AuthorizationContext;
} {
  return { principalId, context: allowContext(principalId) };
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

/** The baseline security policy content (loose JSON; overrides applied last). */
export function policyContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
  };
}

/** The conforming sandbox subject (loose JSON; overrides applied last). */
export function conformingSubject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    extensionId: EXTENSION_ID,
    extensionVersion: '1.2.0',
    extensionManifestDigest: MANIFEST_DIGEST,
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

/** A valid W023 listing version content (loose JSON; overrides applied last). */
export function listingContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.marketplace.listing-version',
    schemaVersion: 1,
    listingId: LISTING_ID,
    version: '1.0.0',
    developerTenantId: TENANT,
    displayName: 'Terrain Viewer',
    description: 'Sandboxed terrain visualization extension.',
    capabilityReferences: [{ capabilityId: 'terrain.render', version: '1.0.0' }],
    pricing: { kind: 'free' },
    trustEvidence: [],
    visibility: 'public',
    privateAllowList: [],
    previousVersionDigest: null,
    publishedAt: T0,
    ...overrides,
  };
}

/**
 * A REAL W009 authorization request + decision pair (built through
 * the REAL evaluator, sealed through the REAL decision sealer) — the
 * observation-intake parity fixture.
 */
export function realDecisionFixture(): {
  request: AuthorizationRequest;
  decision: AuthorizationDecision;
} {
  const request: AuthorizationRequest = {
    schemaVersion: 1,
    principalId: DENIED_PRINCIPAL,
    actionKind: 'security.observe',
    resource: { resourceType: 'security-observation', resourceId: EXTENSION_ID, tenantId: TENANT },
  };
  const decision = unwrap(
    evaluate(request, {
      schemaVersion: 1,
      principals: [{ principalId: DENIED_PRINCIPAL, status: 'active', authenticated: true }],
      memberships: [{ principalId: DENIED_PRINCIPAL, tenantId: OTHER_TENANT }],
      knownTenants: [TENANT, OTHER_TENANT],
    }),
  ) as AuthorizationDecision;
  return { request, decision };
}

/**
 * A REAL W009 authorization DECISION (allow), built through the REAL
 * evaluator over a covering membership — the decision-intake parity
 * fixture. Returns the decision carrying its `requestDigest`.
 */
export function realAllowDecision(): AuthorizationDecision {
  const request: AuthorizationRequest = {
    schemaVersion: 1,
    principalId: PRINCIPAL,
    actionKind: 'security.observe',
    resource: { resourceType: 'security-observation', resourceId: EXTENSION_ID, tenantId: TENANT },
  };
  return unwrap(
    evaluate(request, allowContext(PRINCIPAL)),
  ) as AuthorizationDecision;
}
