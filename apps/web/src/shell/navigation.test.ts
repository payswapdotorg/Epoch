// W014 shell navigation gate + state machine: permission gating allow path
// and the typed denials (unauthorized, cross-tenant, unauthenticated,
// inactive, unknown, malformed — named negatives).
import { describe, expect, it } from 'vitest';
import {
  createNavigationStateMachine,
  decideNavigation,
  visibleRoutes,
} from './navigation';
import { createRouteRegistry } from './routes';
import { anonymousSession } from './session';
import { builtInRoutes, REFERENCE_SESSION, REFERENCE_TENANT } from './bootstrap';
import { SHELL_RECORD_VERSION } from './version';
import type { TenantContextValue } from './tenancy';
import type { SessionContextValue } from './session';
import type { RouteDescriptor } from './routes';

const registryResult = createRouteRegistry(builtInRoutes());
if (!registryResult.ok) {
  throw new Error('built-in route registry must build (pinned by routes tests)');
}
const routes = registryResult.value;
const referencePrincipal = REFERENCE_SESSION.principal;
if (referencePrincipal === undefined) {
  throw new Error('reference session principal must exist');
}

describe('shell navigation gate', () => {
  it('allows the reference principal on every built-in route (allow path, positive)', () => {
    for (const route of routes.listRoutes()) {
      const decision = decideNavigation({
        session: REFERENCE_SESSION,
        tenant: REFERENCE_TENANT,
        route,
      });
      expect(decision.outcome, route.routeId).toBe('allow');
    }
  });

  it('visibleRoutes projects exactly the allowed set, in registry order (positive)', () => {
    const visible = visibleRoutes(routes, REFERENCE_SESSION, REFERENCE_TENANT);
    expect(visible.map((route) => route.routeId)).toEqual(
      routes.listRoutes().map((route) => route.routeId),
    );
  });

  it('blocks an unauthorized navigation target with a typed denial (named negative)', () => {
    const session: SessionContextValue = {
      ...REFERENCE_SESSION,
      principal: { ...referencePrincipal, grants: [] },
    };
    const target = routes.resolveStage('plan');
    expect(target.ok).toBe(true);
    if (!target.ok) return;
    const decision = decideNavigation({ session, tenant: REFERENCE_TENANT, route: target.value });
    expect(decision.outcome).toBe('deny');
    if (decision.outcome === 'deny') {
      expect(decision.denial.code).toBe('insufficient-permissions');
      expect(decision.denial.message).toContain('navigator:read');
    }
    // The permission-gated route disappears from the visible projection.
    const visible = visibleRoutes(routes, session, REFERENCE_TENANT);
    expect(visible.some((route) => route.routeId === 'route:plan')).toBe(false);
    expect(visible.some((route) => route.routeId === 'route:home')).toBe(true);
  });

  it('blocks an unauthenticated session with the typed denial (named negative)', () => {
    const target = routes.resolveStage('understand');
    if (!target.ok) throw new Error('fixture');
    const anonymous = decideNavigation({
      session: anonymousSession(),
      tenant: REFERENCE_TENANT,
      route: target.value,
    });
    expect(anonymous.outcome).toBe('deny');
    if (anonymous.outcome === 'deny') {
      expect(anonymous.denial.code).toBe('unauthenticated-principal');
    }
    const expired = decideNavigation({
      session: { ...REFERENCE_SESSION, state: 'expired' },
      tenant: REFERENCE_TENANT,
      route: target.value,
    });
    expect(expired.outcome).toBe('deny');
    if (expired.outcome === 'deny') {
      expect(expired.denial.code).toBe('unauthenticated-principal');
    }
  });

  it('blocks an inactive principal with the typed denial (named negative)', () => {
    const target = routes.resolveStage('decide');
    if (!target.ok) throw new Error('fixture');
    const suspended: SessionContextValue = {
      ...REFERENCE_SESSION,
      principal: { ...referencePrincipal, status: 'suspended' },
    };
    const decision = decideNavigation({ session: suspended, tenant: REFERENCE_TENANT, route: target.value });
    expect(decision.outcome).toBe('deny');
    if (decision.outcome === 'deny') {
      expect(decision.denial.code).toBe('inactive-principal');
    }
  });

  it('blocks a tenant-bound route outside its tenant with the typed cross-tenant denial (named negative)', () => {
    const tenantBound: RouteDescriptor = {
      schemaVersion: SHELL_RECORD_VERSION,
      routeId: 'route:tenant-only',
      path: '/tenant-only',
      title: 'Tenant only',
      requiredPermissions: [],
      tenantId: 'tenant:globex',
    };
    const decision = decideNavigation({
      session: REFERENCE_SESSION,
      tenant: REFERENCE_TENANT, // tenant:epoch-reference
      route: tenantBound,
    });
    expect(decision.outcome).toBe('deny');
    if (decision.outcome === 'deny') {
      expect(decision.denial.code).toBe('cross-tenant-denied');
    }
    // ...and allows it inside the owning tenant.
    const globexTenant: TenantContextValue = { ...REFERENCE_TENANT, tenantId: 'tenant:globex' };
    const inside = decideNavigation({
      session: REFERENCE_SESSION,
      tenant: globexTenant,
      route: tenantBound,
    });
    expect(inside.outcome).toBe('allow');
  });
});

describe('shell navigation state machine', () => {
  function machine(session: SessionContextValue = REFERENCE_SESSION) {
    const created = createNavigationStateMachine({
      registry: routes,
      session,
      tenant: REFERENCE_TENANT,
      initialRouteId: 'route:home',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('fixture');
    return created.value;
  }

  it('starts idle at the initial route and settles on an allowed transition (positive)', () => {
    const nav = machine();
    expect(nav.state()).toEqual({ status: 'idle', routeId: 'route:home' });
    const next = nav.navigate('route:plan');
    expect(next).toEqual({ status: 'settled', routeId: 'route:plan' });
    expect(nav.state()).toEqual({ status: 'settled', routeId: 'route:plan' });
  });

  it('a denied attempt keeps the current route and records the typed denial (negative)', () => {
    const nav = machine();
    nav.navigate('route:decide');
    const blocked = nav.navigate('route:acquire'); // allowed, for setup
    expect(blocked.status).toBe('settled');
    // Now deny: anonymous session machine.
    const anon = machine(anonymousSession());
    const result = anon.navigate('route:verify');
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.routeId).toBe('route:home'); // unchanged
      expect(result.denial.code).toBe('unauthenticated-principal');
    }
    expect(anon.state()).toEqual(result);
  });

  it('an unknown route id is the typed unknown-route blocked state (named negative)', () => {
    const nav = machine();
    const result = nav.navigate('route:does-not-exist');
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.denial.code).toBe('unknown-route');
      expect(result.routeId).toBe('route:home');
    }
  });

  it('a public route (no required permissions) is navigable by an anonymous session', () => {
    const nav = machine(anonymousSession());
    const result = nav.navigate('route:home');
    expect(result).toEqual({ status: 'settled', routeId: 'route:home' });
  });

  it('a malformed route id is the typed malformed-route blocked state (named negative)', () => {
    const nav = machine();
    const result = nav.navigate('definitely not a route id!');
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.denial.code).toBe('malformed-route');
    }
  });

  it('an unresolvable initial route rejects machine construction (negative)', () => {
    const created = createNavigationStateMachine({
      registry: routes,
      session: REFERENCE_SESSION,
      tenant: REFERENCE_TENANT,
      initialRouteId: 'route:missing',
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe('unknown-route');
    }
  });
});
