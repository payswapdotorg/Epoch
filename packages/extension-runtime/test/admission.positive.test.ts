// Positive admission tests: manifest admission per flavor, digest
// verification, capability binding resolution against a live registry,
// deterministic surface descriptions, and extension lifecycle.
import { describe, expect, it } from 'vitest';
import { EXTENSION_SDK_CONTRACT_VERSION } from '@epoch/extension-sdk';
import {
  ExtensionSandboxHost,
  fixedClock,
  mapWorldView,
  cannedCapabilityInvoker,
  parseSandboxSurfaceDescription,
} from '../src/index';
import { manifest, sealed, stressRegistry } from './helpers';

function buildHost() {
  return new ExtensionSandboxHost({
    registry: stressRegistry(),
    clock: fixedClock('2026-07-01T12:00:00.000Z'),
    worldView: mapWorldView({ 'world:beam-42': { kind: 'beam', loadKn: 42 } }),
    capabilityInvoker: cannedCapabilityInvoker(() => ({
      status: 'completed' as const,
      response: { outputs: { 'max-stress-mpa': 88.5 } },
    })),
  });
}

describe('extension admission (positive)', () => {
  it('admits a valid sealed manifest and creates a session', () => {
    const host = buildHost();
    const result = host.admitExtension(sealed(manifest()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.record.manifest.extensionId).toBe('extension:stress-toolkit');
    expect(result.value.record.lifecycle).toBe('registered');
  });

  it.each([
    ['declarative', {}],
    [
      'wasm',
      {
        flavor: 'wasm',
        entryPoints: [
          {
            kind: 'wasm',
            name: 'stress-render',
            title: 'Stress renderer component',
            component: {
              schemaVersion: 1,
              componentId: 'engineering.stress-visualizer',
              componentVersion: '1.0.0',
              worldName: 'stress-view',
              imports: [
                {
                  interfaceName: 'epoch:world/reader',
                  functions: [{ functionName: 'read-entity', params: [{ name: 'entity-ref', type: 'string' }], result: 'string' }],
                },
              ],
              exports: [
                { interfaceName: 'epoch:view/renderer', functions: [{ functionName: 'render-frame', params: [], result: 'string' }] },
              ],
              sections: [
                {
                  name: 'core-module-main',
                  kind: 'core-module',
                  byteSize: 4096,
                  contentDigest: 'a'.repeat(64),
                },
              ],
            },
          },
        ],
      },
    ],
    [
      'remote',
      {
        flavor: 'remote',
        dataHandling: { classification: 'external-transfer', notes: 'Solver processes meshes server-side.' },
        entryPoints: [
          {
            kind: 'remote',
            name: 'fem-solve',
            title: 'Remote FEM solver',
            service: {
              serviceId: 'engineering.fem-service',
              transport: 'grpc',
              contract: { contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' },
              operations: [
                {
                  name: 'solve-static',
                  inputs: [
                    { name: 'load-kn', kind: 'number', required: true, description: 'Rated load in kilonewtons.', unit: 'kN' },
                  ],
                  outputs: [
                    { name: 'max-stress-mpa', kind: 'number', required: true, description: 'Peak von Mises stress.', unit: 'MPa' },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
    [
      'ui',
      {
        flavor: 'ui',
        entryPoints: [
          {
            kind: 'ui',
            name: 'stress-panel',
            title: 'Stress panel',
            surface: 'panel',
            inputs: [{ name: 'load-kn', kind: 'number', required: true, description: 'Rated load in kilonewtons.', unit: 'kN' }],
            outputs: [],
          },
        ],
      },
    ],
  ])('admits a valid %s-flavor manifest', (flavor, overrides) => {
    const host = buildHost();
    const result = host.admitExtension(sealed(manifest(overrides)));
    expect(result.ok, flavor).toBe(true);
    if (!result.ok) return;
    expect(result.value.record.manifest.flavor).toBe(flavor);
  });

  it('resolves capability bindings against the live registry deterministically (highest satisfying version within the caret range)', () => {
    const host = buildHost();
    const result = host.admitExtension(sealed(manifest()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.record.bindings).toEqual([
      {
        capabilityId: 'engineering.stress-analysis',
        capabilityVersion: '1.2.3',
        capabilityManifestDigest: result.value.record.bindings[0]!.capabilityManifestDigest,
        bindingConstraint: { kind: 'caret', version: '1.0.0' },
      },
    ]);
  });

  it('admits a second, distinct extension alongside the first (sorted listing)', () => {
    const host = buildHost();
    const first = host.admitExtension(sealed(manifest()));
    const second = host.admitExtension(
      sealed(manifest({ extensionId: 'extension:alpha-toolkit', grants: [] })),
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(host.listSessions().map((session) => session.record.manifest.extensionId)).toEqual([
      'extension:alpha-toolkit',
      'extension:stress-toolkit',
    ]);
  });
});

describe('deterministic sandbox surface descriptions (positive)', () => {
  it('describes the boundary: content address, resolved pins, frozen grants', () => {
    const host = buildHost();
    const result = host.admitExtension(sealed(manifest()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const description = result.value.describeSandboxSurface();
    expect(description.schemaVersion).toBe(1);
    expect(description.extensionManifestDigest).toBe(result.value.record.manifestDigest);
    expect(description.flavor).toBe('declarative');
    expect(description.trustClass).toBe('t2');
    expect(description.bindings.map((binding) => binding.capabilityId)).toEqual([
      'engineering.stress-analysis',
    ]);
    expect(description.grants[0]!.hostFunctions).toEqual(['clock.read', 'log.write', 'world.read']);
    expect(description.grants[0]!.resourceScopes).toEqual([{ resource: 'world', access: 'read' }]);
  });

  it('identical admissions produce identical descriptions, regardless of host admission order', () => {
    const hostA = buildHost();
    const hostB = buildHost();
    const left = hostA.admitExtension(sealed(manifest()));
    const right = hostB.admitExtension(sealed(manifest()));
    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    expect(left.value.describeSandboxSurface()).toEqual(right.value.describeSandboxSurface());
  });

  it('the surface description parses back through its schema (round-trip)', () => {
    const host = buildHost();
    const result = host.admitExtension(sealed(manifest()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const description = result.value.describeSandboxSurface();
    const parsed = parseSandboxSurfaceDescription(description);
    expect(parsed.ok).toBe(true);
  });

  it('binds against the SDK contract version declared by the fixture', () => {
    // The manifest fixture references epoch.extension-sdk@1.0.0; the SDK
    // surface pins that the published contract version matches.
    expect(EXTENSION_SDK_CONTRACT_VERSION).toBe('1.0.0');
  });
});


describe('extension lifecycle (positive)', () => {
  it('deprecates and retires an admitted extension with typed transitions', () => {
    const host = buildHost();
    const admitted = host.admitExtension(sealed(manifest()));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const deprecated = host.deprecateExtension('extension:stress-toolkit');
    expect(deprecated.ok).toBe(true);
    const retired = host.retireExtension('extension:stress-toolkit');
    expect(retired.ok).toBe(true);
    expect(host.getSession('extension:stress-toolkit')!.record.lifecycle).toBe('retired');
  });
});
