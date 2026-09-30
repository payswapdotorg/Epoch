/**
 * @epoch/authentication — tenant-safe authorization propagation.
 *
 * Builds the W009 authorization REQUEST for a session scope; decisions
 * are @epoch/authorization's fail-closed evaluator (evaluate imported
 * VERBATIM — this seam never decides, never grants). The helper also
 * builds the caller-supplied CONTEXT shape the evaluator consumes so the
 * gateway cannot hand-roll contexts.
 */
import {
  evaluate,
  type AuthorizationContext,
  type AuthorizationDecision,
  type AuthorizationRequest,
  type AuthorizationResult,
} from '@epoch/authorization';
import type { PrincipalId } from '@epoch/identity';
import type { TenantId } from '@epoch/tenancy';
import type { SessionRecord } from './types';

/**
 * The authorization request for a session acting on a resource: WHO
 * (session principal) wants to do WHAT (action kind) to WHICH
 * tenancy-scoped resource. The session's tenant rides the resource
 * reference (tenant-safe propagation).
 */
export function authorizationRequestFor(
  session: SessionRecord,
  actionKind: string,
  resource: {
    readonly resourceType: string;
    readonly resourceId: string;
    readonly workspaceId?: string | undefined;
    readonly projectId?: string | undefined;
  },
): AuthorizationRequest {
  return {
    schemaVersion: 1,
    principalId: session.session.principalId,
    actionKind,
    resource: {
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      tenantId: session.session.tenantId,
      ...(resource.workspaceId !== undefined ? { workspaceId: resource.workspaceId } : {}),
      ...(resource.projectId !== undefined ? { projectId: resource.projectId } : {}),
    },
  };
}

/**
 * The caller-supplied decision context builder: principal fact + tenant
 * membership fact for ONE principal + the known tenants. The evaluator
 * canonicalizes before matching; unknown/unauthenticated principals are
 * DENIED fail-closed BY THE KERNEL (never here).
 */
export function sessionAuthorizationContext(
  principalId: PrincipalId,
  tenantId: TenantId,
  knownTenants: readonly TenantId[],
  options: { readonly authenticated?: boolean; readonly status?: 'active' | 'suspended' | 'deactivated' } = {},
): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: options.status ?? 'active', authenticated: options.authenticated ?? true }],
    memberships: [{ principalId, tenantId }],
    knownTenants: [...knownTenants].sort(),
  };
}

/** Evaluate a request (verbatim delegation to the W009 decision point). */
export function evaluateAuthorization(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): AuthorizationResult<AuthorizationDecision> {
  return evaluate(request, context);
}
