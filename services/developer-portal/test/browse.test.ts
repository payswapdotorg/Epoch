// CAPABILITY BROWSE coverage (W007): the portal browses and resolves
// against the REAL registry — deterministic ordering, filters, the
// registry's own resolution semantics (retired never resolve, highest
// satisfying version wins), and the structural seam (a real
// CapabilityRegistry satisfies CapabilityBrowseSurface).
import { describe, expect, it } from 'vitest';
import { CapabilityRegistry } from '@epoch/capability-registry';
import { DeveloperPortalHost } from '../src/index';
import type { CapabilityBrowseSurface } from '../src/index';
import {
  AUTH,
  CAPABILITY,
  CAPABILITY_2,
  DEVELOPER,
  expectError,
  fixtureRegistry,
  unwrap,
} from './helpers';

describe('developer portal capability browsing (W007)', () => {
  it('the REAL CapabilityRegistry satisfies the browse seam structurally', () => {
    const registry: CapabilityBrowseSurface = fixtureRegistry();
    expect(registry.size).toBe(3);
  });

  it('lists every registered capability in deterministic order', () => {
    const portal = new DeveloperPortalHost({ registry: fixtureRegistry() });
    const records = unwrap(
      portal.browseCapabilities({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    expect(records.map((record) => [record.manifest.capabilityId, record.manifest.version])).toEqual([
      [CAPABILITY_2, '2.0.0'],
      [CAPABILITY, '1.0.0'],
      [CAPABILITY, '1.1.0'],
    ]);
  });

  it('filters by category (the W007 vocabulary)', () => {
    const registry = fixtureRegistry();
    const portal = new DeveloperPortalHost({ registry });
    const source = unwrap(
      portal.browseCapabilities({ asTenant: DEVELOPER, authorization: AUTH, category: 'simulation' }),
    );
    expect(source).toHaveLength(3);
    const empty = unwrap(
      portal.browseCapabilities({ asTenant: DEVELOPER, authorization: AUTH, category: 'source' }),
    );
    expect(empty).toHaveLength(0);
  });

  it('filters by lifecycle state', () => {
    const registry = fixtureRegistry();
    // Deprecate then retire one record through the REAL registry API.
    unwrap(registry.deprecate({ capabilityId: CAPABILITY_2, version: '2.0.0' }));
    unwrap(registry.retire({ capabilityId: CAPABILITY_2, version: '2.0.0' }));
    const portal = new DeveloperPortalHost({ registry });
    const retired = unwrap(
      portal.browseCapabilities({ asTenant: DEVELOPER, authorization: AUTH, lifecycle: 'retired' }),
    );
    expect(retired.map((record) => record.manifest.capabilityId)).toEqual([CAPABILITY_2]);
    const registered = unwrap(
      portal.browseCapabilities({ asTenant: DEVELOPER, authorization: AUTH, lifecycle: 'registered' }),
    );
    expect(registered).toHaveLength(2);
  });

  it('resolves an exact pin and the highest satisfying version under a caret', () => {
    const portal = new DeveloperPortalHost({ registry: fixtureRegistry() });
    const exact = unwrap(
      portal.resolveCapability({
        asTenant: DEVELOPER,
        authorization: AUTH,
        capabilityId: CAPABILITY,
        constraint: { kind: 'exact', version: '1.0.0' },
      }),
    );
    expect(exact.manifest.version).toBe('1.0.0');
    const caret = unwrap(
      portal.resolveCapability({
        asTenant: DEVELOPER,
        authorization: AUTH,
        capabilityId: CAPABILITY,
        constraint: { kind: 'caret', version: '1.0.0' },
      }),
    );
    // The best match is the HIGHEST satisfying version (W007 rule).
    expect(caret.manifest.version).toBe('1.1.0');
  });

  it('rejects resolution of an unknown capability id (typed carrier)', () => {
    const portal = new DeveloperPortalHost({ registry: fixtureRegistry() });
    const error = expectError(
      portal.resolveCapability({
        asTenant: DEVELOPER,
        authorization: AUTH,
        capabilityId: 'stress.not-registered',
        constraint: { kind: 'exact', version: '1.0.0' },
      }),
    );
    expect(error.code).toBe('unknown-capability-reference');
  });

  it('rejects resolution of a retired capability (lifecycle carrier)', () => {
    const registry = fixtureRegistry();
    unwrap(registry.deprecate({ capabilityId: CAPABILITY_2, version: '2.0.0' }));
    unwrap(registry.retire({ capabilityId: CAPABILITY_2, version: '2.0.0' }));
    const portal = new DeveloperPortalHost({ registry });
    const error = expectError(
      portal.resolveCapability({
        asTenant: DEVELOPER,
        authorization: AUTH,
        capabilityId: CAPABILITY_2,
        constraint: { kind: 'exact', version: '2.0.0' },
      }),
    );
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('never mutates the registry through the portal surface', () => {
    const registry = fixtureRegistry();
    const portal = new DeveloperPortalHost({ registry });
    unwrap(portal.browseCapabilities({ asTenant: DEVELOPER, authorization: AUTH }));
    unwrap(
      portal.resolveCapability({
        asTenant: DEVELOPER,
        authorization: AUTH,
        capabilityId: CAPABILITY,
        constraint: { kind: 'exact', version: '1.0.0' },
      }),
    );
    expect(registry.size).toBe(3);
    expect(registry instanceof CapabilityRegistry).toBe(true);
  });
});
