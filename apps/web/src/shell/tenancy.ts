/**
 * @epoch/web shell tenant context (W014).
 *
 * Tenant context is established at the SHELL BOUNDARY and threaded through
 * providers to every hosted surface (the W014 pin). The types here are
 * SHELL-OWNED structural mirrors of the @epoch/tenancy contracts: per the
 * Tech Lead dependency policy there is NO runtime dependency on
 * @epoch/tenancy (the merged apps/web manifest had no app-layer runtime dep
 * on kernel packages, so no precedent allows one) — the shapes are
 * self-contained in shell source and drift-pinned by devDependency parity
 * tests (`src/shell/parity.test.ts`).
 *
 * Tenant isolation (R12) is a typed boundary here: switching a context
 * across tenants, or admitting tenant-scoped subjects from another tenant,
 * is a typed `cross-tenant-denied` REJECTION (a value), never a runtime
 * exception.
 */
import {
  crossTenantDeniedError,
  missingTenantContextError,
  shellOk,
  type ShellResult,
} from './errors';
import {
  PROJECT_ID_PATTERN,
  SHELL_RECORD_VERSION,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
  type ProjectId,
  type TenantId,
  type WorkspaceId,
} from './version';

/** Opaque tenant identity `tenant:<slug>` (structural mirror of @epoch/tenancy `TenantId`). */
export type { TenantId, WorkspaceId, ProjectId } from './version';

/**
 * A tenant scope reference: the active tenant, optionally narrowed to a
 * workspace and project (structural mirror of the TenantScope discipline —
 * see @epoch/experience-protocol `TenantScope` and @epoch/tenancy
 * containment).
 */
export interface ShellTenantScope {
  readonly tenantId: TenantId;
  readonly workspaceId?: WorkspaceId | undefined;
  readonly projectId?: ProjectId | undefined;
}

/**
 * The tenant context value threaded through the shell providers: a plain,
 * serialization-friendly JSON object (it crosses the server/client
 * component boundary).
 */
export interface TenantContextValue {
  readonly schemaVersion: typeof SHELL_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly workspaceId?: WorkspaceId | undefined;
  readonly projectId?: ProjectId | undefined;
  readonly displayName: string;
}

/** Validate a tenant context value (total, typed). */
export function validateTenantContext(input: unknown): ShellResult<TenantContextValue> {
  const issues: { path: string; message: string }[] = [];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'Tenant context must be a plain object.',
        issues: [{ path: '', message: 'expected a plain object' }],
      },
    };
  }
  const record = input as Record<string, unknown>;
  if (record.schemaVersion !== SHELL_RECORD_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `expected ${SHELL_RECORD_VERSION} (version skew is rejected before any other diagnostic)`,
    });
  }
  if (typeof record.tenantId !== 'string' || !TENANT_ID_PATTERN.test(record.tenantId)) {
    issues.push({ path: 'tenantId', message: 'expected an opaque tenant id (tenant:<slug>)' });
  }
  if (record.workspaceId !== undefined) {
    if (typeof record.workspaceId !== 'string' || !WORKSPACE_ID_PATTERN.test(record.workspaceId)) {
      issues.push({
        path: 'workspaceId',
        message: 'expected an opaque workspace id (workspace:<slug>) when present',
      });
    }
  }
  if (record.projectId !== undefined) {
    if (typeof record.projectId !== 'string' || !PROJECT_ID_PATTERN.test(record.projectId)) {
      issues.push({
        path: 'projectId',
        message: 'expected an opaque project id (project:<slug>) when present',
      });
    }
  }
  if (typeof record.displayName !== 'string' || record.displayName.trim().length === 0) {
    issues.push({ path: 'displayName', message: 'expected a non-empty display name' });
  }
  if (issues.length > 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'Malformed tenant context.',
        issues,
      },
    };
  }
  return shellOk({
    schemaVersion: SHELL_RECORD_VERSION as typeof SHELL_RECORD_VERSION,
    tenantId: record.tenantId as TenantId,
    workspaceId: record.workspaceId as WorkspaceId | undefined,
    projectId: record.projectId as ProjectId | undefined,
    displayName: record.displayName as string,
  });
}

/** Extract the bare scope of a tenant context. */
export function scopeOf(context: TenantContextValue): ShellTenantScope {
  return {
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
  };
}

/**
 * Assert two scopes share the TENANT isolation boundary (R12). Workspace or
 * project narrowing differences are NOT tenant violations — only a tenant
 * mismatch is the typed `cross-tenant-denied` rejection.
 */
export function assertSameTenantScope(
  context: ShellTenantScope,
  subject: ShellTenantScope,
): ShellResult<void> {
  if (context.tenantId !== subject.tenantId) {
    return {
      ok: false,
      error: crossTenantDeniedError(context.tenantId, subject.tenantId),
    };
  }
  return shellOk(undefined);
}

/**
 * Switch the active tenant context: same-tenant re-narrowing (e.g. moving
 * between workspaces of one tenant) is allowed; crossing tenants is the
 * typed `cross-tenant-denied` rejection. A missing/null current context is
 * the typed `missing-tenant-context` rejection (fail-closed).
 */
export function switchTenantContext(
  current: TenantContextValue | null,
  next: TenantContextValue,
): ShellResult<TenantContextValue> {
  if (current === null) {
    return {
      ok: false,
      error: missingTenantContextError(
        'Cannot switch tenants without an established tenant context (fail-closed).',
      ),
    };
  }
  if (current.tenantId !== next.tenantId) {
    return {
      ok: false,
      error: crossTenantDeniedError(current.tenantId, next.tenantId),
    };
  }
  return shellOk(next);
}

/** Deterministic ordering key of a scope (tenant, then workspace, then project). */
export function tenantScopeKey(scope: ShellTenantScope): string {
  return [scope.tenantId, scope.workspaceId ?? '', scope.projectId ?? ''].join('\u0000');
}

/**
 * Whether a tenant-scoped subject (e.g. a feature descriptor) is visible in
 * a context: tenant-generic subjects (no tenant binding) are visible to
 * every context; tenant-scoped subjects are visible only inside their own
 * tenant (isolation by omission).
 */
export function isTenantVisible(
  context: ShellTenantScope,
  subject: { readonly tenantId?: TenantId | undefined },
): boolean {
  return subject.tenantId === undefined || subject.tenantId === context.tenantId;
}
