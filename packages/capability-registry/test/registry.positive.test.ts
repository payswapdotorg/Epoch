// Positive tests: registration round-trips per category, version-
// constrained resolution with best-match, lifecycle transitions, and
// deterministic ordering.
import { describe, expect, it } from 'vitest';
import { canonicalJsonStringify } from '@epoch/agent-protocol';
import { CapabilityRegistry, type CapabilityRecord } from '../src/index';
import { ALL_CATEGORIES, manifest, seal } from './helpers';

describe('register/lookup round-trip per category (positive)', () => {
  it.each(ALL_CATEGORIES)('registers and gets back a %s capability', (category) => {
    const registry = new CapabilityRegistry();
    const capabilityId = `engineering.roundtrip-${category.replace(/-/g, '')}`;
    const registered = registry.register(
      seal(manifest({ category, capabilityId, version: '1.0.0' })),
    );
    expect(registered.ok, category).toBe(true);
    if (!registered.ok) return;
    expect(registered.value.lifecycle).toBe('registered');
    expect(registered.value.manifestDigest).toBe(registered.value.manifestDigest);

    const got = registry.get({ capabilityId, version: '1.0.0' });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value).toEqual(registered.value);
  });

  it('registering several versions of one capability id keeps them distinct', () => {
    const registry = new CapabilityRegistry();
    for (const version of ['1.0.0', '1.1.0', '2.0.0']) {
      const result = registry.register(seal(manifest({ version })));
      expect(result.ok, version).toBe(true);
    }
    expect(registry.size).toBe(3);
    const got = registry.get({ capabilityId: 'engineering.stress-analysis', version: '1.1.0' });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.manifest.version).toBe('1.1.0');
  });

  it('deregister removes exactly the pinned record', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    registry.register(seal(manifest({ version: '2.0.0' })));
    const removed = registry.deregister({
      capabilityId: 'engineering.stress-analysis',
      version: '1.0.0',
    });
    expect(removed.ok).toBe(true);
    expect(registry.size).toBe(1);
    expect(registry.get({ capabilityId: 'engineering.stress-analysis', version: '1.0.0' }).ok).toBe(
      false,
    );
    expect(registry.get({ capabilityId: 'engineering.stress-analysis', version: '2.0.0' }).ok).toBe(
      true,
    );
  });
});

describe('version-constrained resolution (positive)', () => {
  function registryWithVersions(...versions: string[]): CapabilityRegistry {
    const registry = new CapabilityRegistry();
    for (const version of versions) {
      const result = registry.register(seal(manifest({ version })));
      if (!result.ok) throw new Error(`fixture registration failed: ${version}`);
    }
    return registry;
  }
  const ID = 'engineering.stress-analysis';

  it('an exact pin resolves that exact version', () => {
    const registry = registryWithVersions('1.0.0', '1.2.0', '1.2.3', '2.0.0');
    const resolved = registry.resolve({ capabilityId: ID, constraint: { kind: 'exact', version: '1.2.3' } });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.manifest.version).toBe('1.2.3');
  });

  it('a caret constraint resolves the HIGHEST satisfying version (best match)', () => {
    const registry = registryWithVersions('1.0.0', '1.2.0', '1.2.3', '1.9.9', '2.0.0', '2.4.0');
    const resolved = registry.resolve({ capabilityId: ID, constraint: { kind: 'caret', version: '1.2.0' } });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.manifest.version).toBe('1.9.9');
  });

  it('caret respects the major boundary (2.x is not admitted by ^1.2.0)', () => {
    const registry = registryWithVersions('2.0.0', '2.4.0');
    const resolved = registry.resolve({ capabilityId: ID, constraint: { kind: 'caret', version: '1.2.0' } });
    expect(resolved.ok).toBe(false);
  });

  it('caret on 0.x respects the minor boundary (npm-caret carve-out)', () => {
    const registry = registryWithVersions('0.2.1', '0.2.9', '0.3.0');
    const resolved = registry.resolve({ capabilityId: ID, constraint: { kind: 'caret', version: '0.2.1' } });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.manifest.version).toBe('0.2.9');
  });

  it('resolution is deterministic across insertion orders', () => {
    const forward = registryWithVersions('1.0.0', '1.2.0', '1.2.3');
    const backward = new CapabilityRegistry();
    for (const version of ['1.2.3', '1.2.0', '1.0.0']) {
      backward.register(seal(manifest({ version })));
    }
    const a = forward.resolve({ capabilityId: ID, constraint: { kind: 'caret', version: '1.0.0' } });
    const b = backward.resolve({ capabilityId: ID, constraint: { kind: 'caret', version: '1.0.0' } });
    expect(a.ok && b.ok).toBe(true);
    expect((a as { value: CapabilityRecord }).value.manifest.version).toBe(
      (b as { value: CapabilityRecord }).value.manifest.version,
    );
  });

  it('a deprecated capability still resolves (deprecation is advisory)', () => {
    const registry = registryWithVersions('1.0.0', '1.2.0');
    const deprecated = registry.deprecate({ capabilityId: ID, version: '1.2.0' });
    expect(deprecated.ok).toBe(true);
    const resolved = registry.resolve({ capabilityId: ID, constraint: { kind: 'caret', version: '1.0.0' } });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.manifest.version).toBe('1.2.0');
    expect(resolved.value.lifecycle).toBe('deprecated');
  });
});

describe('lifecycle transitions (positive)', () => {
  const ID = 'engineering.stress-analysis';

  it('registered -> deprecated -> retired is legal', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    const deprecated = registry.deprecate({ capabilityId: ID, version: '1.0.0' });
    expect(deprecated.ok).toBe(true);
    if (!deprecated.ok) return;
    expect(deprecated.value.lifecycle).toBe('deprecated');
    const retired = registry.retire({ capabilityId: ID, version: '1.0.0' });
    expect(retired.ok).toBe(true);
    if (!retired.ok) return;
    expect(retired.value.lifecycle).toBe('retired');
  });

  it('registered -> retired is legal (immediate retirement)', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    const retired = registry.retire({ capabilityId: ID, version: '1.0.0' });
    expect(retired.ok).toBe(true);
    if (!retired.ok) return;
    expect(retired.value.lifecycle).toBe('retired');
  });

  it('lifecycle filters compose with category filters in list()', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    registry.register(
      seal(manifest({ capabilityId: 'engineering.geometry-mesh', category: 'reconstruction', version: '0.1.0' })),
    );
    registry.deprecate({ capabilityId: ID, version: '1.0.0' });
    expect(registry.list({ lifecycle: 'deprecated' })).toHaveLength(1);
    expect(registry.list({ category: 'reconstruction' })).toHaveLength(1);
    expect(registry.list({ category: 'reconstruction', lifecycle: 'registered' })).toHaveLength(1);
    expect(registry.list({ category: 'simulation', lifecycle: 'registered' })).toHaveLength(0);
  });
});

describe('deterministic ordering (positive)', () => {
  it('list() is sorted by capabilityId then version, not insertion order', () => {
    const shuffled: Array<[string, string]> = [
      ['engineering.stress-analysis', '2.0.0'],
      ['analysis.mesh-quality', '1.0.0'],
      ['engineering.stress-analysis', '1.0.0'],
      ['analysis.mesh-quality', '0.9.0'],
      ['engineering.stress-analysis', '1.10.0'],
      ['visualization.stress-heatmap', '1.0.0'],
    ];
    const registry = new CapabilityRegistry();
    for (const [capabilityId, version] of shuffled) {
      const result = registry.register(seal(manifest({ capabilityId, version })));
      expect(result.ok).toBe(true);
    }
    const listed = registry.list();
    expect(listed.map((r) => [r.manifest.capabilityId, r.manifest.version])).toEqual([
      ['analysis.mesh-quality', '0.9.0'],
      ['analysis.mesh-quality', '1.0.0'],
      ['engineering.stress-analysis', '1.0.0'],
      ['engineering.stress-analysis', '1.10.0'],
      ['engineering.stress-analysis', '2.0.0'],
      ['visualization.stress-heatmap', '1.0.0'],
    ]);
  });

  it('two registries with different insertion orders serialize identically', () => {
    const manifests = [
      manifest({ capabilityId: 'b.second', version: '1.0.0' }),
      manifest({ capabilityId: 'a.first', version: '2.0.0' }),
      manifest({ capabilityId: 'a.first', version: '1.0.0' }),
      manifest({ capabilityId: 'c.third', version: '0.3.0' }),
    ];
    const one = new CapabilityRegistry();
    for (const m of manifests) one.register(seal(m));
    const two = new CapabilityRegistry();
    for (const m of [...manifests].reverse()) two.register(seal(m));
    const serialize = (records: readonly CapabilityRecord[]): string =>
      canonicalJsonStringify(records as never);
    expect(serialize(one.list())).toBe(serialize(two.list()));
  });
});
