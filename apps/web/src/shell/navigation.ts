/**
 * @epoch/web shell navigation gate + state machine (W014).
 *
 * Permission-gated navigation over TYPED route descriptors. The gate is
 * FAIL-CLOSED and speaks the platform's typed denial vocabulary:
 *
 * - shell-owned codes — `unknown-route`, `malformed-route`,
 *   `insufficient-permissions` (registry/permission concerns);
 * - codes MIRRORED from @epoch/authorization — `cross-tenant-denied`,
 *   `unauthenticated-principal`, `inactive-principal` (parity-pinned
 *   subset; the authorization decision point itself remains
 *   @epoch/authorization's authority — this gate is the shell's
 *   projection-level reference check over caller-supplied typed facts, not
 *   a second decision point).
 *
 * The state machine is a pure, deterministic transition system over typed
 * states (`idle` -> `settled` | `blocked`); a denied attempt leaves the
 * current route and records the typed denial.
 */
import type { TenantContextValue } from './tenancy';
import type { SessionContextValue } from './session';
import type { RouteDescriptor, RouteRegistry } from './routes';
import type { NavigationDenialCode } from './version';
import { ROUTE_ID_PATTERN } from './version';
import type { ShellResult } from './errors';
import { shellOk } from './errors';

/** One typed navigation denial (exactly one code + audit message). */
export interface NavigationDenial {
  readonly code: NavigationDenialCode;
  readonly message: string;
}

/** The navigation decision: allow (with the resolved route) or typed denial. */
export type NavigationDecision =
  | { readonly outcome: 'allow'; readonly route: RouteDescriptor }
  | { readonly outcome: 'deny'; readonly denial: NavigationDenial };

/** The inputs of one navigation attempt. */
export interface NavigationGateInput {
  readonly session: SessionContextValue;
  readonly tenant: TenantContextValue;
  readonly route: RouteDescriptor;
}

/**
 * Decide one navigation attempt (fail-closed, deterministic check order):
 *
 * 1. tenant binding — a tenant-bound route outside the active tenant is
 *    `cross-tenant-denied` (R12) — isolation wins over everything else;
 * 2. public routes — a route that requires no permissions (the landing
 *    route) is navigable by any session inside the tenant boundary;
 * 3. session liveness — permission-gated routes demand a live session: an
 *    anonymous/expired session is `unauthenticated-principal`, a
 *    suspended/deactivated principal is `inactive-principal`;
 * 4. permissions — every required permission must be granted, else
 *    `insufficient-permissions`.
 */
export function decideNavigation(input: NavigationGateInput): NavigationDecision {
  const { session, tenant, route } = input;
  if (route.tenantId !== undefined && route.tenantId !== tenant.tenantId) {
    return {
      outcome: 'deny',
      denial: {
        code: 'cross-tenant-denied',
        message:
          `Route '${route.routeId}' belongs to tenant '${route.tenantId}' and is not ` +
          `navigable from tenant '${tenant.tenantId}' (tenant isolation, R12).`,
      },
    };
  }
  if (route.requiredPermissions.length === 0) {
    return { outcome: 'allow', route };
  }
  if (session.state === 'anonymous' || session.state === 'expired') {
    return {
      outcome: 'deny',
      denial: {
        code: 'unauthenticated-principal',
        message:
          session.state === 'anonymous'
            ? 'Navigation requires an authenticated session (the current session is anonymous).'
            : 'Navigation requires an authenticated session (the current session is expired).',
      },
    };
  }
  const principal = session.principal;
  if (principal === undefined || principal.status !== 'active' || !principal.authenticated) {
    return {
      outcome: 'deny',
      denial: {
        code: 'inactive-principal',
        message: 'Navigation requires an active, authenticated principal.',
      },
    };
  }
  const missing = route.requiredPermissions.filter(
    (permission) => !principal.grants.includes(permission),
  );
  if (missing.length > 0) {
    return {
      outcome: 'deny',
      denial: {
        code: 'insufficient-permissions',
        message: `Route '${route.routeId}' requires permissions not granted: ${missing.join(', ')}.`,
      },
    };
  }
  return { outcome: 'allow', route };
}

/** The routes a session may navigate to (deterministic registry order). */
export function visibleRoutes(
  registry: RouteRegistry,
  session: SessionContextValue,
  tenant: TenantContextValue,
): readonly RouteDescriptor[] {
  return registry
    .listRoutes()
    .filter((route) => decideNavigation({ session, tenant, route }).outcome === 'allow');
}

/** The typed navigation state machine states. */
export type NavigationState =
  | { readonly status: 'idle'; readonly routeId: string }
  | { readonly status: 'settled'; readonly routeId: string }
  | { readonly status: 'blocked'; readonly routeId: string; readonly denial: NavigationDenial };

/** The inputs of the navigation state machine. */
export interface NavigationMachineInput {
  readonly registry: RouteRegistry;
  readonly session: SessionContextValue;
  readonly tenant: TenantContextValue;
  readonly initialRouteId: string;
}

/** The navigation state machine (pure transitions, typed states). */
export interface NavigationStateMachine {
  /** The current state. */
  state(): NavigationState;
  /**
   * Attempt to navigate to a route id: an allowed target settles the
   * machine there; an unknown id or a typed denial blocks the attempt and
   * KEEPS the current route. Returns the state after the attempt.
   */
  navigate(routeId: string): NavigationState;
}

/** Create a navigation state machine (the initial route must be resolvable). */
export function createNavigationStateMachine(
  input: NavigationMachineInput,
): ShellResult<NavigationStateMachine> {
  const initial = input.registry.resolve(input.initialRouteId);
  if (!initial.ok) {
    return initial;
  }
  let current: NavigationState = { status: 'idle', routeId: initial.value.routeId };
  return shellOk({
    state: () => current,
    navigate: (routeId: string) => {
      if (typeof routeId !== 'string' || !ROUTE_ID_PATTERN.test(routeId)) {
        current = {
          status: 'blocked',
          routeId: current.routeId,
          denial: {
            code: 'malformed-route',
            message: `Cannot navigate to '${String(routeId)}': not a well-formed route id (route:<slug>).`,
          },
        };
        return current;
      }
      const resolved = input.registry.resolve(routeId);
      if (!resolved.ok) {
        current = {
          status: 'blocked',
          routeId: current.routeId,
          denial: {
            code: 'unknown-route',
            message: `Cannot navigate to '${routeId}': unknown route id.`,
          },
        };
        return current;
      }
      const decision = decideNavigation({
        session: input.session,
        tenant: input.tenant,
        route: resolved.value,
      });
      if (decision.outcome === 'deny') {
        current = {
          status: 'blocked',
          routeId: current.routeId,
          denial: decision.denial,
        };
        return current;
      }
      current = { status: 'settled', routeId: decision.route.routeId };
      return current;
    },
  });
}
