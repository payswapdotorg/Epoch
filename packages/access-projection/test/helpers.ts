// Shared test helpers: total-result unwrappers + the REAL W009 context
// builders (the services/execution-tracking helpers pattern — decisions
// always come from the REAL @epoch/authorization evaluator).
import {
  evaluate,
  sealAuthorizationDecision,
  type AuthorizationContext,
  type AuthorizationDecision,
  type AuthorizationDecisionRegistration,
  type AuthorizationRequest,
  type AuthorizationResult,
} from '@epoch/authorization';
import type { AccessProjectionError, AccessProjectionResult } from '../src/errors';
import { TENANT } from './fixtures';

/** Unwrap a total result or fail loudly (positive-path helper). */
export function unwrap<T>(
  result: { ok: true; value: T } | { ok: false; error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Strip the content digest off one sealed record (content for re-sealing). */
export function withoutDigest<T extends { contentDigest: string }>(sealed: T): Omit<T, 'contentDigest'> {
  const { contentDigest, ...rest } = sealed;
  void contentDigest;
  return rest;
}

/** Unwrap a total result or fail loudly, naming the expected code. */
export function expectError<T>(
  result: { ok: true; value: T } | { ok: false; error: unknown },
  code: string,
): AccessProjectionError {
  if (result.ok) {
    throw new Error(`expected an error ("${code}") but the operation succeeded`);
  }
  const error = result.error as { code?: string };
  if (error?.code !== code) {
    throw new Error(
      `expected error code "${code}" but encountered "${String(error?.code)}": ${JSON.stringify(result.error)}`,
    );
  }
  return result.error as AccessProjectionError;
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
    memberships: [{ principalId, tenantId: 'tenant:initech' }],
    // The resource tenant IS known — the deny is the cross-tenant one.
    knownTenants: [TENANT, 'tenant:initech'],
  };
}

/** A REAL W009 context whose principal is suspended (deny: inactive-principal). */
export function inactivePrincipalContext(principalId: string): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: 'suspended', authenticated: true }],
    memberships: [{ principalId, tenantId: TENANT }],
    knownTenants: [TENANT],
  };
}

/** Build one W009 access-projection request (loose). */
export function accessRequest(
  principalId: string,
  action: 'view' | 'export' | 'share',
  resource: { resourceType: string; resourceId: string; tenantId: string },
): AuthorizationRequest {
  return {
    schemaVersion: 1,
    principalId,
    actionKind: `access-projection.${action}`,
    resource,
  };
}

/**
 * Evaluate + seal one REAL W009 decision for an access-projection
 * request (the exact shape the kernel consumes in stage 1).
 */
export function sealedDecision(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): AuthorizationDecisionRegistration {
  const decision: AuthorizationResult<AuthorizationDecision> = evaluate(request, context);
  if (!decision.ok) throw new Error(`W009 evaluation failed: ${JSON.stringify(decision.error)}`);
  const sealed = sealAuthorizationDecision(decision.value);
  if (!sealed.ok) throw new Error(`W009 sealing failed: ${JSON.stringify(sealed.error)}`);
  return sealed.value;
}

/** A kernel-side total result (for expectError ergonomics in tests). */
export type { AccessProjectionResult };
