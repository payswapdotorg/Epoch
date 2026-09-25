/**
 * @epoch/web shell route descriptors and registry (W014).
 *
 * The shell's navigation model is a registry of TYPED, VERSIONED route
 * descriptors — never ad-hoc strings. The built-in registry declares the
 * home route plus exactly one route per Solution Navigator lifecycle stage
 * (spec/solution-navigator-architecture.md, binding). App Router segments
 * under `apps/web/app` are the wiring of these descriptors: the descriptor
 * list and the segment tree stay in lockstep by construction (the route
 * wiring smoke test pins the correspondence).
 *
 * Determinism: registry iteration order is derived from the data (home
 * first, then lifecycle stages in canonical order, route id as the
 * tiebreak) — NEVER from insertion order.
 */
import {
  duplicateRouteError,
  unknownRouteError,
  validationError,
  shellOk,
  type ShellResult,
} from './errors';
import {
  NAVIGATOR_STAGES,
  ROUTE_ID_PATTERN,
  ROUTE_PATH_PATTERN,
  SHELL_PERMISSIONS,
  SHELL_RECORD_VERSION,
  TENANT_ID_PATTERN,
  type NavigatorStage,
  type ShellPermission,
  type TenantId,
} from './version';

/** The lifecycle position label of a stage (canonical display titles). */
export const STAGE_TITLES: Readonly<Record<NavigatorStage, string>> = {
  understand: 'Understand',
  decide: 'Decide',
  plan: 'Plan / Program of Work',
  acquire: 'Acquire',
  realize: 'Realize',
  observe: 'Observe / Actualize',
  verify: 'Verify',
  forecast: 'Forecast',
  close: 'Close / Outcomes',
  learn: 'Learn',
};

/**
 * A typed route descriptor. `stage` is undefined for non-lifecycle routes
 * (the home route); `tenantId` optionally binds a route to one tenant
 * (tenant-generic when absent) — a bound route is invisible and unnavigable
 * outside its tenant (typed `cross-tenant-denied`).
 */
export interface RouteDescriptor {
  readonly schemaVersion: typeof SHELL_RECORD_VERSION;
  readonly routeId: string;
  readonly path: string;
  readonly title: string;
  readonly stage?: NavigatorStage | undefined;
  readonly requiredPermissions: readonly ShellPermission[];
  readonly tenantId?: TenantId | undefined;
}

/** Validate and normalize a route descriptor (total, typed). */
export function validateRouteDescriptor(input: unknown): ShellResult<RouteDescriptor> {
  const issues: { path: string; message: string }[] = [];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: validationError('Route descriptor must be a plain object.', [
        { path: '', message: 'expected a plain object' },
      ]),
    };
  }
  const record = input as Record<string, unknown>;
  if (record.schemaVersion !== SHELL_RECORD_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `expected ${SHELL_RECORD_VERSION} (version skew is rejected before any other diagnostic)`,
    });
  }
  if (typeof record.routeId !== 'string' || !ROUTE_ID_PATTERN.test(record.routeId)) {
    issues.push({ path: 'routeId', message: 'expected an opaque route id (route:<slug>)' });
  }
  if (typeof record.path !== 'string' || !ROUTE_PATH_PATTERN.test(record.path)) {
    issues.push({
      path: 'path',
      message: 'expected the root path or a single lowercase kebab segment (e.g. "/" or "/understand")',
    });
  }
  if (typeof record.title !== 'string' || record.title.trim().length === 0) {
    issues.push({ path: 'title', message: 'expected a non-empty title' });
  }
  if (record.stage !== undefined) {
    if (
      typeof record.stage !== 'string' ||
      !NAVIGATOR_STAGES.includes(record.stage as NavigatorStage)
    ) {
      issues.push({
        path: 'stage',
        message: `expected one of the navigator stages (${NAVIGATOR_STAGES.join(', ')}) when present`,
      });
    }
  }
  if (record.tenantId !== undefined) {
    if (typeof record.tenantId !== 'string' || !TENANT_ID_PATTERN.test(record.tenantId)) {
      issues.push({
        path: 'tenantId',
        message: 'expected an opaque tenant id (tenant:<slug>) when present',
      });
    }
  }
  if (record.requiredPermissions === undefined) {
    issues.push({ path: 'requiredPermissions', message: 'expected an array (possibly empty)' });
  } else if (!Array.isArray(record.requiredPermissions)) {
    issues.push({ path: 'requiredPermissions', message: 'expected an array (possibly empty)' });
  } else {
    for (const permission of record.requiredPermissions) {
      if (
        typeof permission !== 'string' ||
        !SHELL_PERMISSIONS.includes(permission as ShellPermission)
      ) {
        issues.push({
          path: 'requiredPermissions',
          message: `every permission must be a declared shell permission (${SHELL_PERMISSIONS.join(', ')})`,
        });
        break;
      }
    }
  }
  if (issues.length > 0) {
    return {
      ok: false,
      error: validationError('Malformed route descriptor.', issues),
    };
  }
  return shellOk({
    schemaVersion: SHELL_RECORD_VERSION as typeof SHELL_RECORD_VERSION,
    routeId: record.routeId as string,
    path: record.path as string,
    title: record.title as string,
    stage: record.stage as NavigatorStage | undefined,
    requiredPermissions: [...new Set(record.requiredPermissions as readonly string[])].sort() as readonly ShellPermission[],
    tenantId: record.tenantId as TenantId | undefined,
  });
}

/** The deterministic iteration key of a route: home first, then canonical lifecycle order. */
export function routeSortKey(route: RouteDescriptor): string {
  const stageIndex = route.stage === undefined ? -1 : NAVIGATOR_STAGES.indexOf(route.stage);
  return `${String(stageIndex).padStart(2, '0')}\u0000${route.routeId}`;
}

/** Sort a route list deterministically (canonical order, id tiebreak). */
export function sortRoutes(routes: readonly RouteDescriptor[]): readonly RouteDescriptor[] {
  return [...routes].sort((a, b) => {
    const keyA = routeSortKey(a);
    const keyB = routeSortKey(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}

/**
 * The route registry: a total, immutable-once-built index over typed route
 * descriptors. Unknown ids are the typed `unknown-route` rejection;
 * malformed descriptors are the typed `validation` rejection at
 * registration time (fail-closed: a malformed descriptor NEVER enters the
 * registry).
 */
export interface RouteRegistry {
  /** All routes, deterministically ordered (home first, then lifecycle order). */
  listRoutes(): readonly RouteDescriptor[];
  /** Resolve by opaque route id (typed `unknown-route` rejection). */
  resolve(routeId: string): ShellResult<RouteDescriptor>;
  /** Resolve by App Router path (typed `unknown-route` rejection). */
  resolvePath(path: string): ShellResult<RouteDescriptor>;
  /** Resolve the route of one navigator stage, if declared. */
  resolveStage(stage: NavigatorStage): ShellResult<RouteDescriptor>;
}

/** Build a route registry from descriptors (validation + duplicate checks). */
export function createRouteRegistry(
  descriptors: readonly unknown[],
): ShellResult<RouteRegistry> {
  const validated: RouteDescriptor[] = [];
  for (const candidate of descriptors) {
    const result = validateRouteDescriptor(candidate);
    if (!result.ok) {
      return result;
    }
    validated.push(result.value);
  }
  const byId = new Map<string, RouteDescriptor>();
  const byPath = new Map<string, RouteDescriptor>();
  const byStage = new Map<NavigatorStage, RouteDescriptor>();
  for (const route of validated) {
    if (byId.has(route.routeId)) {
      return { ok: false, error: duplicateRouteError(route.routeId) };
    }
    const pathOwner = byPath.get(route.path);
    if (pathOwner !== undefined) {
      return {
        ok: false,
        error: validationError(
          `Route path '${route.path}' is already wired by '${pathOwner.routeId}'.`,
          [{ path: 'path', message: `duplicate path (already wired by '${pathOwner.routeId}')` }],
        ),
      };
    }
    if (route.stage !== undefined) {
      const stageOwner = byStage.get(route.stage);
      if (stageOwner !== undefined) {
        return {
          ok: false,
          error: validationError(
            `Navigator stage '${route.stage}' is already wired by '${stageOwner.routeId}'.`,
            [
              {
                path: 'stage',
                message: `duplicate stage wiring (already wired by '${stageOwner.routeId}')`,
              },
            ],
          ),
        };
      }
      byStage.set(route.stage, route);
    }
    byId.set(route.routeId, route);
    byPath.set(route.path, route);
  }
  const ordered: readonly RouteDescriptor[] = sortRoutes(validated);
  return shellOk({
    listRoutes: () => ordered,
    resolve: (routeId: string) => {
      const route = byId.get(routeId);
      return route === undefined ? { ok: false, error: unknownRouteError(routeId) } : shellOk(route);
    },
    resolvePath: (path: string) => {
      for (const route of ordered) {
        if (route.path === path) return shellOk(route);
      }
      return { ok: false, error: unknownRouteError(path) };
    },
    resolveStage: (stage: NavigatorStage) => {
      const route = byStage.get(stage);
      return route === undefined
        ? {
            ok: false,
            error: unknownRouteError(`stage:${stage}`),
          }
        : shellOk(route);
    },
  });
}
