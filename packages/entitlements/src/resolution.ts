/**
 * Entitlement RESOLUTION — the W024 seam that rides the W009 tenancy
 * hierarchy and delegates grant matching to the W023 marketplace
 * authority (architecture lock rule 11: the entitlement GRANT RECORD is
 * the authority; payment state never is).
 *
 * What resolution IS:
 * - a PURE function over Epoch-owned records ONLY (W023 grants +
 *   revocations, plus the optional W009 TenancyHierarchy for scope
 *   containment). No clocks, no randomness, no I/O, no registries;
 * - the tenancy seam: a workspace-scoped or project-scoped query is
 *   first validated against the real W009 hierarchy (the workspace must
 *   exist and sit inside the queried tenant; a project must exist and sit
 *   inside the queried workspace — unknown or foreign scopes are typed
 *   `tenant-scope-rejected` / `cross-tenant-denied` rejections);
 * - the delegation: grant MATCHING (scope coverage, revocation
 *   immediacy, latest-grant witness selection) is the W023
 *   `checkEntitlement` authority — this function NEVER re-implements it.
 *   A project-scoped query resolves to its containing workspace before
 *   the delegation (W023 grants scope over tenants and workspaces only).
 *
 * What resolution is NOT:
 * - it is NOT a second entitlement authority: every positive answer
 *   carries the exact W023 grant record that produced it;
 * - it does NOT read payment state, settlement state, or invoices —
 *   billing never feeds back into entitlement truth.
 */
import { checkEntitlement } from '@epoch/marketplace';
import type {
  EntitlementGrantRecord,
  EntitlementRevokeRecord,
  MarketplaceError,
} from '@epoch/marketplace';
import { TenancyHierarchy } from '@epoch/tenancy';
import type {
  EntitlementResolutionEcho,
  EntitlementsError,
  EntitlementsResult,
} from './errors';

/** The scope query resolved by {@link resolveEntitlement}. */
export interface EntitlementResolutionQuery {
  readonly tenantId: string;
  readonly listingId: string;
  /** Optional workspace narrowing (validated against the tenancy hierarchy when supplied). */
  readonly workspaceId?: string | undefined;
  /** Optional project narrowing (its containing workspace must be resolvable). */
  readonly projectId?: string | undefined;
}

/** The positive outcome of entitlement resolution. */
export interface EntitlementResolution {
  /** The exact W023 grant record that satisfies the query (the authority's witness). */
  readonly entitlement: EntitlementGrantRecord;
  /** How the effective scope was covered: tenant-wide or one workspace. */
  readonly scopeCoverage: 'tenant' | 'workspace';
  /**
   * The W009 containment path (root -> scope) as opaque node ids, when a
   * hierarchy was supplied; empty otherwise. Deterministic: platform,
   * tenant, workspace, project in root-to-leaf order.
   */
  readonly tenancyPath: readonly string[];
  /** How many grants matched the query before revocation filtering (W023 witness data). */
  readonly matchedGrantCount: number;
  /** How many matching grants are revoked (W023 witness data). */
  readonly revokedMatchingCount: number;
}

/** Echo the resolution query onto denials (never a payment echo). */
function echoOf(query: EntitlementResolutionQuery): EntitlementResolutionEcho {
  return {
    listingId: query.listingId,
    tenantId: query.tenantId,
    workspaceId: query.workspaceId,
    projectId: query.projectId,
  };
}

/** Re-shape one W023 marketplace denial into the entitlements error union. */
function mapMarketplaceDenial(
  error: MarketplaceError,
  query: EntitlementResolutionQuery,
): EntitlementsError {
  if (error.code === 'entitlement-denied') {
    return {
      code: 'entitlement-denied',
      message: error.message,
      query: echoOf(query),
    };
  }
  if (error.code === 'entitlement-revoked') {
    return {
      code: 'entitlement-revoked',
      message: error.message,
      entitlementId: error.entitlementId,
      revokedAt: error.revokedAt,
    };
  }
  if (error.code === 'cross-tenant-denied') {
    return {
      code: 'cross-tenant-denied',
      message: error.message,
      expectedTenantId: error.expectedTenantId,
      encounteredTenantId: error.encounteredTenantId,
    };
  }
  return {
    code: 'validation',
    message: error.message,
    issues: [],
  };
}

/**
 * Resolve the effective entitlement for one scope query. Total and pure:
 *
 * 1. when a tenancy hierarchy is supplied and the query narrows to a
 *    workspace and/or project, the scope is validated against the REAL
 *    W009 containment (unknown node -> `tenant-scope-rejected`;
 *    workspace outside the queried tenant -> `cross-tenant-denied`;
 *    project outside the queried/derived workspace ->
 *    `tenant-scope-rejected`);
 * 2. a project-scoped query resolves to its containing workspace (W023
 *    grants scope over tenants and workspaces only);
 * 3. grant matching is DELEGATED to the W023 `checkEntitlement`
 *    authority with the effective (tenant, listing, workspace) query —
 *    denials echo back typed;
 * 4. the positive answer carries the W023 witness grant, the effective
 *    scope coverage, the W009 containment path, and the W023 match
 *    counts.
 */
export function resolveEntitlement(input: {
  grants: readonly EntitlementGrantRecord[];
  revocations: readonly EntitlementRevokeRecord[];
  tenancy?: TenancyHierarchy | undefined;
  query: EntitlementResolutionQuery;
}): EntitlementsResult<EntitlementResolution> {
  const { grants, revocations, tenancy, query } = input;

  let effectiveWorkspaceId = query.workspaceId;
  let tenancyPath: string[] = [];

  if (tenancy !== undefined && (query.workspaceId !== undefined || query.projectId !== undefined)) {
    if (query.workspaceId !== undefined) {
      const within = tenancy.isWithin(query.workspaceId, query.tenantId);
      if (!within.ok) {
        return {
          ok: false,
          error: {
            code: 'tenant-scope-rejected',
            message: `workspace "${query.workspaceId}" does not resolve in the W009 tenancy hierarchy (unknown node)`,
            tenantId: query.tenantId,
            nodeId: query.workspaceId,
          },
        };
      }
      if (!within.value) {
        return {
          ok: false,
          error: {
            code: 'cross-tenant-denied',
            message: `workspace "${query.workspaceId}" is not within tenant "${query.tenantId}" (R12 multi-tenant isolation)`,
            expectedTenantId: query.tenantId,
            encounteredTenantId: query.workspaceId,
          },
        };
      }
    }
    if (query.projectId !== undefined) {
      const projectWithin = tenancy.isWithin(query.projectId, query.workspaceId ?? query.tenantId);
      if (!projectWithin.ok) {
        return {
          ok: false,
          error: {
            code: 'tenant-scope-rejected',
            message: `project "${query.projectId}" does not resolve in the W009 tenancy hierarchy (unknown node)`,
            tenantId: query.tenantId,
            nodeId: query.projectId,
          },
        };
      }
      if (!projectWithin.value) {
        return {
          ok: false,
          error: {
            code: 'tenant-scope-rejected',
            message: `project "${query.projectId}" is not within the queried scope (tenant "${query.tenantId}"${query.workspaceId === undefined ? '' : `, workspace "${query.workspaceId}"`})`,
            tenantId: query.tenantId,
            nodeId: query.projectId,
          },
        };
      }
      if (effectiveWorkspaceId === undefined) {
        // The project's containing workspace becomes the effective W023 scope.
        const path = tenancy.pathToRoot(query.projectId);
        if (path.ok) {
          const workspaceNode = path.value.find((node) => node.node.kind === 'workspace');
          if (workspaceNode !== undefined) {
            effectiveWorkspaceId = workspaceNode.node.nodeId;
          }
        }
      }
    }
  }
  if (tenancy !== undefined) {
    // pathToRoot is root-first (platform -> ... -> node); the projection
    // echoes that canonical order for every scope depth.
    const scopeNodeId = query.projectId ?? query.workspaceId ?? query.tenantId;
    const path = tenancy.pathToRoot(scopeNodeId);
    if (path.ok) {
      tenancyPath = path.value.map((node) => node.node.nodeId);
    }
  }

  const decision = checkEntitlement({
    grants,
    revocations,
    query: {
      tenantId: query.tenantId,
      listingId: query.listingId,
      workspaceId: effectiveWorkspaceId,
    },
  });
  if (!decision.ok) {
    return { ok: false, error: mapMarketplaceDenial(decision.error, query) };
  }
  return {
    ok: true,
    value: {
      entitlement: decision.value.entitlement,
      scopeCoverage: decision.value.entitlement.scope.kind,
      tenancyPath,
      matchedGrantCount: decision.value.matchedGrantCount,
      revokedMatchingCount: decision.value.revokedMatchingCount,
    },
  };
}
