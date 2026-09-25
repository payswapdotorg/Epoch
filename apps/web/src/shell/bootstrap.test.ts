// W014 shell reference bootstrap: assembly, determinism, and the
// features-absent baseline.
import { describe, expect, it } from 'vitest';
import {
  builtInMounts,
  builtInRoutes,
  createReferenceShell,
  HOME_ROUTE,
  REFERENCE_SESSION,
  REFERENCE_TENANT,
  referenceShell,
  stagePath,
  stageRouteId,
} from './bootstrap';
import { validateSessionContext } from './session';
import { validateTenantContext } from './tenancy';

describe('shell reference bootstrap', () => {
  it('the built-in descriptors validate against their own registries (positive)', () => {
    const shell = createReferenceShell();
    expect(shell.routes.listRoutes()).toHaveLength(11);
    expect(shell.routes.resolve('route:home').ok).toBe(true);
    expect(shell.mounts.listMounts()).toHaveLength(7);
  });

  it('the reference tenant and session are well-formed typed values (positive)', () => {
    expect(validateTenantContext(REFERENCE_TENANT).ok).toBe(true);
    expect(validateSessionContext(REFERENCE_SESSION).ok).toBe(true);
  });

  it('stage ids and paths follow the deterministic mapping', () => {
    expect(stageRouteId('understand')).toBe('route:understand');
    expect(stagePath('learn')).toBe('/learn');
    expect(HOME_ROUTE.routeId).toBe('route:home');
    expect(HOME_ROUTE.path).toBe('/');
    expect(HOME_ROUTE.requiredPermissions).toEqual([]);
  });

  it('two reference shells are equal (determinism: no clocks, no randomness)', () => {
    const a = createReferenceShell();
    const b = createReferenceShell();
    expect(a.routes.listRoutes().map((r) => r.routeId)).toEqual(
      b.routes.listRoutes().map((r) => r.routeId),
    );
    expect(a.mounts.listMounts()).toEqual(b.mounts.listMounts());
    expect(a.features.listFeatures()).toEqual(b.features.listFeatures());
  });

  it('the module-level reference shell is the same assembly (positive)', () => {
    expect(referenceShell.routes.listRoutes().map((r) => r.routeId)).toEqual(
      createReferenceShell().routes.listRoutes().map((r) => r.routeId),
    );
  });

  it('the reference feature set is EMPTY by construction (features register explicitly)', () => {
    expect(referenceShell.features.listFeatureIds()).toEqual([]);
    expect(referenceShell.features.listFeatures()).toEqual([]);
  });

  it('custom tenants assemble a shell with the empty feature set for that tenant', () => {
    const tenant = {
      schemaVersion: 1 as const,
      tenantId: 'tenant:acme',
      displayName: 'Acme',
    };
    const shell = createReferenceShell({ tenant });
    expect(shell.tenant.tenantId).toBe('tenant:acme');
    expect(shell.features.listFeatureIds()).toEqual([]);
  });

  it('builtInRoutes/builtInMounts return fresh copies (no shared mutable state)', () => {
    const a = builtInRoutes();
    const b = builtInRoutes();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(builtInMounts()).toEqual(builtInMounts());
    expect(builtInMounts()).not.toBe(builtInMounts());
  });
});
