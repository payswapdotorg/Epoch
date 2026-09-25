// W014 shell route registry: typed descriptors, deterministic ordering,
// and the unknown/malformed-route named negatives.
import { describe, expect, it } from 'vitest';
import { createRouteRegistry, routeSortKey, sortRoutes, validateRouteDescriptor } from './routes';
import { builtInRoutes } from './bootstrap';
import type { ShellError, ShellIssue } from './errors';
import { SHELL_RECORD_VERSION } from './version';

/** Narrow a shell error to its validation issues (fails the test otherwise). */
function validationIssuesOf(error: ShellError): readonly ShellIssue[] {
  expect(error.code).toBe('validation');
  if (error.code !== 'validation') {
    throw new Error(`expected a validation error, got '${error.code}'`);
  }
  return error.issues;
}

describe('shell route registry', () => {
  it('validates the built-in descriptors (home + 10 lifecycle stages)', () => {
    for (const route of builtInRoutes()) {
      const result = validateRouteDescriptor(route);
      expect(result.ok, route.routeId).toBe(true);
    }
  });

  it('builds the built-in registry: deterministic order (home first, then lifecycle)', () => {
    const registry = createRouteRegistry(builtInRoutes());
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const ids = registry.value.listRoutes().map((route) => route.routeId);
    expect(ids).toEqual([
      'route:home',
      'route:understand',
      'route:decide',
      'route:plan',
      'route:acquire',
      'route:realize',
      'route:observe',
      'route:verify',
      'route:forecast',
      'route:close',
      'route:learn',
    ]);
    // Resolve by id, by path, and by stage.
    expect(registry.value.resolve('route:home').ok).toBe(true);
    expect(registry.value.resolvePath('/learn').ok).toBe(true);
    const stage = registry.value.resolveStage('verify');
    expect(stage.ok).toBe(true);
    if (stage.ok) {
      expect(stage.value.path).toBe('/verify');
      expect(stage.value.stage).toBe('verify');
    }
  });

  it('iteration order is derived from the data, never from insertion order', () => {
    const reversed = [...builtInRoutes()].reverse();
    const a = createRouteRegistry(builtInRoutes());
    const b = createRouteRegistry(reversed);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.value.listRoutes().map((r) => r.routeId)).toEqual(
        a.value.listRoutes().map((r) => r.routeId),
      );
    }
  });

  it('sortRoutes / routeSortKey: home sorts before stages; stages in canonical order', () => {
    // home (stage undefined) sorts with stage index -1 => prefix '-1'.
    expect(routeSortKey(builtInRoutes()[0]).startsWith('-1')).toBe(true);
    const sorted = sortRoutes([...builtInRoutes()].reverse());
    expect(sorted[0].routeId).toBe('route:home');
    expect(sorted[1].routeId).toBe('route:understand');
    expect(sorted[sorted.length - 1].routeId).toBe('route:learn');
  });

  it('rejects an unknown route id with the typed unknown-route error (named negative)', () => {
    const registry = createRouteRegistry(builtInRoutes());
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const unknown = registry.value.resolve('route:does-not-exist');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error.code).toBe('unknown-route');
      if (unknown.error.code === 'unknown-route') {
        expect(unknown.error.routeId).toBe('route:does-not-exist');
      }
    }
    expect(registry.value.resolvePath('/nope').ok).toBe(false);
    // An unregistered stage is also the typed unknown-route rejection.
    const stage = registry.value.resolveStage('learn');
    expect(stage.ok).toBe(true); // 'learn' IS registered
  });

  it('rejects malformed route descriptors with typed validation errors (named negative)', () => {
    const cases: readonly unknown[] = [
      'route:home',
      null,
      { schemaVersion: 2, routeId: 'route:x', path: '/x', title: 'X', requiredPermissions: [] }, // version skew
      { schemaVersion: 1, routeId: 'x', path: '/x', title: 'X', requiredPermissions: [] }, // bad id
      { schemaVersion: 1, routeId: 'route:x', path: 'x', title: 'X', requiredPermissions: [] }, // bad path
      { schemaVersion: 1, routeId: 'route:x', path: '/X', title: 'X', requiredPermissions: [] }, // uppercase path
      { schemaVersion: 1, routeId: 'route:x', path: '/x', title: ' ', requiredPermissions: [] }, // blank title
      {
        schemaVersion: 1,
        routeId: 'route:x',
        path: '/x',
        title: 'X',
        stage: 'dream',
        requiredPermissions: [],
      }, // unknown stage
      {
        schemaVersion: 1,
        routeId: 'route:x',
        path: '/x',
        title: 'X',
        requiredPermissions: ['admin:all'],
      }, // undeclared permission
      {
        schemaVersion: 1,
        routeId: 'route:x',
        path: '/x',
        title: 'X',
        requiredPermissions: 'navigator:read',
      }, // not an array
      {
        schemaVersion: 1,
        routeId: 'route:x',
        path: '/x',
        title: 'X',
        requiredPermissions: [],
        tenantId: 'acme',
      }, // malformed tenant binding
    ];
    for (const input of cases) {
      const result = validateRouteDescriptor(input);
      expect(result.ok, `expected rejection for ${JSON.stringify(input)}`).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('validation');
        expect(validationIssuesOf(result.error).length).toBeGreaterThan(0);
      }
    }
    // A malformed descriptor never enters the registry.
    const registry = createRouteRegistry([
      ...builtInRoutes(),
      { schemaVersion: 1, routeId: 'bad', path: '/bad', title: 'Bad', requiredPermissions: [] },
    ]);
    expect(registry.ok).toBe(false);
  });

  it('rejects duplicate route ids and duplicate paths with typed errors (negative)', () => {
    const duplicateId = createRouteRegistry([
      ...builtInRoutes(),
      { ...builtInRoutes()[0], path: '/other' },
    ]);
    expect(duplicateId.ok).toBe(false);
    if (!duplicateId.ok) {
      expect(duplicateId.error.code).toBe('duplicate-route');
    }
    const duplicatePath = createRouteRegistry([
      { schemaVersion: SHELL_RECORD_VERSION, routeId: 'route:a', path: '/a', title: 'A', requiredPermissions: [] },
      { schemaVersion: SHELL_RECORD_VERSION, routeId: 'route:b', path: '/a', title: 'B', requiredPermissions: [] },
    ]);
    expect(duplicatePath.ok).toBe(false);
    if (!duplicatePath.ok) {
      expect(duplicatePath.error.code).toBe('validation');
    }
    // Duplicate stage wiring is rejected too.
    const duplicateStage = createRouteRegistry([
      { schemaVersion: SHELL_RECORD_VERSION, routeId: 'route:a', path: '/a', title: 'A', stage: 'plan', requiredPermissions: [] },
      { schemaVersion: SHELL_RECORD_VERSION, routeId: 'route:b', path: '/b', title: 'B', stage: 'plan', requiredPermissions: [] },
    ]);
    expect(duplicateStage.ok).toBe(false);
  });

  it('required permissions are normalized (deduplicated, sorted)', () => {
    const result = validateRouteDescriptor({
      schemaVersion: SHELL_RECORD_VERSION,
      routeId: 'route:x',
      path: '/x',
      title: 'X',
      requiredPermissions: ['navigator:read', 'navigator:read'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiredPermissions).toEqual(['navigator:read']);
    }
  });
});
