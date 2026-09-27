/**
 * Session-scoped tenants via @epoch/tenancy (the W017 pin).
 *
 * A desktop shell session is scoped to one tenant path of the tenancy
 * hierarchy (Platform -> Tenant -> Workspace -> Project — architecture.md
 * "Tenancy"): the host proposes the scope when it opens the session, and
 * the shell RESOLVES it against the reference tenancy hierarchy (a pinned
 * runtime dependency — genuine runtime composition, never a mirror). The
 * resolved scope carries the tenancy node digests as opaque provenance, so
 * every session artifact addresses the exact tenancy revision it was
 * scoped to.
 *
 * The experience-facing projection: {@link tenantScopeOf} projects the
 * resolved scope onto the W011 `TenantScope` vocabulary (opaque ids,
 * equality-based isolation — R12) carried by every experience document and
 * renderer binding.
 *
 * Tenancy errors surface as typed `malformed-record` failures (with the
 * verbatim tenancy code in the message); a scope whose workspace/project
 * references a node of ANOTHER tenant is the typed `cross-tenant-denied`
 * rejection (R12 — the isolation boundary is the tenant).
 */
import {
  TenancyHierarchy,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
  PROJECT_ID_PATTERN,
  type TenancyError,
  type TenantId,
  type WorkspaceId,
  type ProjectId,
} from '@epoch/tenancy';
import type { TenantScope } from '@epoch/experience-protocol';
import {
  crossTenantDeniedError,
  desktopOk,
  malformedRecordError,
  type DesktopResult,
} from './errors';

/** The proposed session scope (host input; opaque tenancy ids). */
export interface SessionScopeInput {
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

/** The resolved, tenant-scoped session scope (with tenancy provenance). */
export interface DesktopSessionScope {
  /** The owning tenant (opaque `tenant:<slug>`). */
  readonly tenantId: TenantId;
  /** The optional workspace narrowing (opaque `workspace:<slug>`). */
  readonly workspaceId: WorkspaceId | undefined;
  /** The optional project narrowing (opaque `project:<slug>`). */
  readonly projectId: ProjectId | undefined;
  /** SHA-256 digest of the resolved tenant node (exact-revision provenance). */
  readonly tenantNodeDigest: string;
  /** SHA-256 digest of the resolved workspace node, when scoped. */
  readonly workspaceNodeDigest: string | undefined;
  /** SHA-256 digest of the resolved project node, when scoped. */
  readonly projectNodeDigest: string | undefined;
}

/** Flatten a tenancy error into the shell taxonomy (verbatim code kept). */
function tenancyError(error: TenancyError): ReturnType<typeof malformedRecordError> {
  return malformedRecordError(
    `the session scope failed tenancy resolution (${error.code}): ${error.message}`,
    [{ path: 'scope', message: `tenancy ${error.code}` }],
  );
}

/** Validate one opaque scope id against its tenancy pattern. */
function scopeIdIssue(
  path: string,
  value: unknown,
  pattern: RegExp,
  label: string,
): { ok: true } | { ok: false; error: ReturnType<typeof malformedRecordError> } {
  if (value === undefined) {
    return { ok: true };
  }
  if (typeof value !== 'string' || !pattern.test(value)) {
    return {
      ok: false,
      error: malformedRecordError(`the session scope carries a malformed ${label} id`, [
        { path, message: `expected an opaque ${label} id` },
      ]),
    };
  }
  return { ok: true };
}

/**
 * Resolve a proposed session scope against the reference tenancy
 * hierarchy. Total and typed:
 * - malformed ids are `malformed-record` failures;
 * - unknown nodes surface the tenancy code inside a `malformed-record`;
 * - a workspace/project that belongs to a DIFFERENT tenant than the scope's
 *   tenant is the typed `cross-tenant-denied` rejection (R12).
 */
export function resolveSessionScope(
  hierarchy: TenancyHierarchy,
  input: SessionScopeInput,
): DesktopResult<DesktopSessionScope> {
  const tenantIdCheck = scopeIdIssue('scope.tenantId', input.tenantId, TENANT_ID_PATTERN, 'tenant');
  if (!tenantIdCheck.ok) {
    return { ok: false, error: tenantIdCheck.error };
  }
  const workspaceIdCheck = scopeIdIssue(
    'scope.workspaceId',
    input.workspaceId,
    WORKSPACE_ID_PATTERN,
    'workspace',
  );
  if (!workspaceIdCheck.ok) {
    return { ok: false, error: workspaceIdCheck.error };
  }
  const projectIdCheck = scopeIdIssue(
    'scope.projectId',
    input.projectId,
    PROJECT_ID_PATTERN,
    'project',
  );
  if (!projectIdCheck.ok) {
    return { ok: false, error: projectIdCheck.error };
  }

  const tenantNode = hierarchy.getNode(input.tenantId as TenantId);
  if (!tenantNode.ok) {
    return { ok: false, error: tenancyError(tenantNode.error) };
  }
  if (tenantNode.value.node.kind !== 'tenant') {
    return {
      ok: false,
      error: malformedRecordError('the session-scope tenant id does not reference a tenant node', [
        { path: 'scope.tenantId', message: `expected a tenant node, encountered kind "${tenantNode.value.node.kind}"` },
      ]),
    };
  }

  let workspaceDigest: string | undefined;
  if (input.workspaceId !== undefined) {
    const workspaceNode = hierarchy.getNode(input.workspaceId as WorkspaceId);
    if (!workspaceNode.ok) {
      return { ok: false, error: tenancyError(workspaceNode.error) };
    }
    if (workspaceNode.value.node.kind !== 'workspace') {
      return {
        ok: false,
        error: malformedRecordError(
          'the session-scope workspace id does not reference a workspace node',
          [
            {
              path: 'scope.workspaceId',
              message: `expected a workspace node, encountered kind "${workspaceNode.value.node.kind}"`,
            },
          ],
        ),
      };
    }
    if (workspaceNode.value.node.parentId !== input.tenantId) {
      return {
        ok: false,
        error: crossTenantDeniedError(
          'scope.workspaceId',
          input.tenantId,
          workspaceNode.value.node.parentId ?? '(platform)',
        ),
      };
    }
    workspaceDigest = workspaceNode.value.nodeDigest;
  }

  let projectDigest: string | undefined;
  if (input.projectId !== undefined) {
    if (input.workspaceId === undefined) {
      return {
        ok: false,
        error: malformedRecordError(
          'a project-scoped session must carry its workspace (containment cannot skip a level)',
          [{ path: 'scope.workspaceId', message: 'required when projectId is present' }],
        ),
      };
    }
    const projectNode = hierarchy.getNode(input.projectId as ProjectId);
    if (!projectNode.ok) {
      return { ok: false, error: tenancyError(projectNode.error) };
    }
    if (projectNode.value.node.kind !== 'project') {
      return {
        ok: false,
        error: malformedRecordError(
          'the session-scope project id does not reference a project node',
          [
            {
              path: 'scope.projectId',
              message: `expected a project node, encountered kind "${projectNode.value.node.kind}"`,
            },
          ],
        ),
      };
    }
    if (projectNode.value.node.parentId !== input.workspaceId) {
      const projectTenant = hierarchy.tenantOf(input.projectId as ProjectId);
      const encountered =
        projectTenant.ok && projectTenant.value !== null
          ? projectTenant.value
          : projectNode.value.node.parentId ?? '(unknown)';
      return {
        ok: false,
        error: crossTenantDeniedError('scope.projectId', input.tenantId, encountered),
      };
    }
    projectDigest = projectNode.value.nodeDigest;
  }

  return desktopOk({
    tenantId: input.tenantId as TenantId,
    workspaceId: input.workspaceId as WorkspaceId | undefined,
    projectId: input.projectId as ProjectId | undefined,
    tenantNodeDigest: tenantNode.value.nodeDigest,
    workspaceNodeDigest: workspaceDigest,
    projectNodeDigest: projectDigest,
  });
}

/** Project a resolved scope onto the W011 TenantScope vocabulary. */
export function tenantScopeOf(scope: DesktopSessionScope): TenantScope {
  return {
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    projectId: scope.projectId,
  };
}

/** The equality-based tenant gate (R12): one scope vs one tenant id. */
export function isWithinTenant(scope: DesktopSessionScope, tenantId: string): boolean {
  return scope.tenantId === tenantId;
}
