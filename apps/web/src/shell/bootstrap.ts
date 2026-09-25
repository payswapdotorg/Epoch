/**
 * @epoch/web shell reference bootstrap (W014).
 *
 * Assembles the shell's REFERENCE state in memory: the built-in route
 * registry (home + one route per Solution Navigator stage), the built-in
 * mounting-point registry (four frame regions + three Experience slots),
 * the reference tenant context, and the reference session (an active,
 * authenticated human principal — provider-neutral in-memory identity, NO
 * real authentication).
 *
 * Everything here is deterministic and side-effect-free: two calls produce
 * equal registries with equal iteration order (no clocks, no randomness,
 * no insertion-order leaks). The reference feature set is EMPTY by
 * construction — features register explicitly through the mounting seam
 * (`src/shell/mounting.ts`), never by discovery.
 */
import {
  createFeatureSet,
  createMountRegistry,
  type FeatureSet,
  type MountRegistry,
} from './mounting';
import { createRouteRegistry, type RouteDescriptor, type RouteRegistry } from './routes';
import type { SessionContextValue } from './session';
import type { TenantContextValue } from './tenancy';
import { SHELL_RECORD_VERSION, type NavigatorStage, type ShellPermission } from './version';

/** The home route descriptor. */
export const HOME_ROUTE: RouteDescriptor = {
  schemaVersion: SHELL_RECORD_VERSION,
  routeId: 'route:home',
  path: '/',
  title: 'Epoch',
  requiredPermissions: [],
};

/** The route id of each navigator stage (deterministic mapping). */
export function stageRouteId(stage: NavigatorStage): string {
  return `route:${stage}`;
}

/** The App Router path of each navigator stage (deterministic mapping). */
export function stagePath(stage: NavigatorStage): string {
  return `/${stage}`;
}

/** The permission every navigator stage route requires. */
const STAGE_PERMISSIONS: readonly ShellPermission[] = ['navigator:read'];

/** The built-in route descriptors: home first, then the lifecycle stages. */
export function builtInRoutes(): readonly RouteDescriptor[] {
  return [
    HOME_ROUTE,
    ...(
      [
        'understand',
        'decide',
        'plan',
        'acquire',
        'realize',
        'observe',
        'verify',
        'forecast',
        'close',
        'learn',
      ] as const
    ).map((stage) => ({
      schemaVersion: SHELL_RECORD_VERSION,
      routeId: stageRouteId(stage),
      path: stagePath(stage),
      title: stage,
      stage,
      requiredPermissions: STAGE_PERMISSIONS,
    })),
  ];
}

/** The built-in mounting points: four frame regions + three Experience slots. */
export function builtInMounts() {
  return [
    {
      schemaVersion: SHELL_RECORD_VERSION,
      mountId: 'mount:header',
      kind: 'region',
      region: 'header',
      acceptedGraphKinds: [],
      description: 'The shell header region (brand, tenant badge, session badge).',
    },
    {
      schemaVersion: SHELL_RECORD_VERSION,
      mountId: 'mount:navigation',
      kind: 'region',
      region: 'navigation',
      acceptedGraphKinds: [],
      description: 'The navigation region (permission-gated route list).',
    },
    {
      schemaVersion: SHELL_RECORD_VERSION,
      mountId: 'mount:content',
      kind: 'region',
      region: 'content',
      acceptedGraphKinds: [],
      description: 'The main content region (route surfaces and feature panels).',
    },
    {
      schemaVersion: SHELL_RECORD_VERSION,
      mountId: 'mount:status',
      kind: 'region',
      region: 'status',
      acceptedGraphKinds: [],
      description: 'The status region (shell version and mount summary).',
    },
    {
      schemaVersion: SHELL_RECORD_VERSION,
      mountId: 'mount:scene',
      kind: 'experience',
      slot: 'scene',
      acceptedGraphKinds: ['2d', '3d', 'animation', 'timeline-replay', 'presence'],
      description: 'The scene surface: spatial/visual presentations of the world.',
    },
    {
      schemaVersion: SHELL_RECORD_VERSION,
      mountId: 'mount:narrative',
      kind: 'experience',
      slot: 'narrative',
      acceptedGraphKinds: ['narrative'],
      description: 'The narrative/status surface: agent narrative beats and status blocks.',
    },
    {
      schemaVersion: SHELL_RECORD_VERSION,
      mountId: 'mount:controls',
      kind: 'experience',
      slot: 'controls',
      acceptedGraphKinds: ['controls'],
      description: 'The candidate/action controls surface: typed control projections.',
    },
  ];
}

/** The reference tenant context (in-memory; the shell establishes it at the boundary). */
export const REFERENCE_TENANT: TenantContextValue = {
  schemaVersion: SHELL_RECORD_VERSION,
  tenantId: 'tenant:epoch-reference',
  workspaceId: 'workspace:reference',
  displayName: 'Epoch Reference Tenant',
};

/** The reference session: an active, authenticated human principal with navigator grants. */
export const REFERENCE_SESSION: SessionContextValue = {
  schemaVersion: SHELL_RECORD_VERSION,
  sessionId: 'session:reference-ada',
  state: 'active',
  principal: {
    principalId: 'principal:ada',
    kind: 'human',
    status: 'active',
    authenticated: true,
    displayName: 'Ada (Reference)',
    grants: ['navigator:read'],
  },
};

/** The fully assembled reference shell (typed, deterministic). */
export interface ReferenceShell {
  readonly routes: RouteRegistry;
  readonly mounts: MountRegistry;
  readonly features: FeatureSet;
  readonly tenant: TenantContextValue;
  readonly session: SessionContextValue;
}

/** Build the reference shell; throws NEVER — the built-ins are validated to be well-formed (pinned by tests). */
export function createReferenceShell(
  options?: {
    readonly tenant?: TenantContextValue | undefined;
    readonly session?: SessionContextValue | undefined;
    readonly features?: readonly unknown[] | undefined;
  },
): ReferenceShell {
  const routes = createRouteRegistry(builtInRoutes());
  const mounts = createMountRegistry(builtInMounts());
  if (!routes.ok || !mounts.ok) {
    // Unreachable by construction: the built-in descriptors are constants
    // pinned by tests. A failure here is a programming error, not a domain
    // error — surface it loudly rather than returning a half-built shell.
    throw new Error(
      `Reference shell bootstrap failed (programming error): ${routes.ok ? '' : routes.error.message} ${mounts.ok ? '' : mounts.error.message}`,
    );
  }
  const tenant = options?.tenant ?? REFERENCE_TENANT;
  const features = createFeatureSet(options?.features ?? [], mounts.value, tenant);
  if (!features.ok) {
    throw new Error(
      `Reference shell feature registration failed (programming error): ${features.error.message}`,
    );
  }
  return {
    routes: routes.value,
    mounts: mounts.value,
    features: features.value,
    tenant,
    session: options?.session ?? REFERENCE_SESSION,
  };
}

/**
 * The module-level reference shell (deterministic, side-effect-free): the
 * single in-memory assembly the App Router wiring renders.
 */
export const referenceShell: ReferenceShell = createReferenceShell();
