// Shared fixtures for the extension-sdk tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely
// (the W006/W007 helpers pattern).
import type { ParameterSpec } from '@epoch/agent-protocol';

/** A shared parameter spec (the agent-protocol shape). */
export const SPEC: ParameterSpec = {
  name: 'load-kn',
  kind: 'number',
  required: true,
  description: 'Rated load in kilonewtons.',
  unit: 'kN',
};

/** Another parameter spec (sorted after SPEC by name). */
export const SPEC2: ParameterSpec = {
  name: 'rating',
  kind: 'number',
  required: false,
  description: 'Safety rating multiplier.',
};

/** A minimal valid Wasm component descriptor as loose JSON (canonical order). */
export function componentDescriptor(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    componentId: 'engineering.stress-visualizer',
    componentVersion: '1.0.0',
    worldName: 'stress-view',
    imports: [
      {
        interfaceName: 'epoch:world/reader',
        functions: [
          { functionName: 'read-entity', params: [{ name: 'entity-ref', type: 'string' }], result: 'string' },
        ],
      },
    ],
    exports: [
      {
        interfaceName: 'epoch:view/renderer',
        functions: [
          { functionName: 'render-frame', params: [], result: 'string' },
        ],
      },
    ],
    sections: [
      {
        name: 'adapter-locale',
        kind: 'adapter',
        byteSize: 4096,
        contentDigest: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      },
      {
        name: 'core-module-main',
        kind: 'core-module',
        byteSize: 65536,
        contentDigest: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
      },
    ],
    ...overrides,
  };
}

/** A minimal valid remote service descriptor as loose JSON (canonical order). */
export function serviceDescriptor(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    serviceId: 'engineering.fem-service',
    transport: 'grpc',
    contract: { contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' },
    operations: [
      {
        name: 'solve-static',
        inputs: [SPEC],
        outputs: [{ name: 'max-stress-mpa', kind: 'number', required: true, description: 'Peak von Mises stress.', unit: 'MPa' }],
      },
    ],
    ...overrides,
  };
}

/** A valid declarative entry point as loose JSON. */
export function declarativeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'declarative',
    name: 'world-ontology',
    title: 'World ontology contributions',
    contributions: ['mapping', 'world-type'],
    ...overrides,
  };
}

/** A valid ui entry point as loose JSON. */
export function uiEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'ui',
    name: 'stress-panel',
    title: 'Stress panel',
    surface: 'panel',
    inputs: [SPEC],
    outputs: [SPEC2],
    ...overrides,
  };
}

/** A valid wasm entry point as loose JSON. */
export function wasmEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'wasm',
    name: 'stress-render',
    title: 'Stress renderer component',
    component: componentDescriptor(),
    ...overrides,
  };
}

/** A valid remote entry point as loose JSON. */
export function remoteEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'remote',
    name: 'fem-solve',
    title: 'Remote FEM solver',
    service: serviceDescriptor(),
    ...overrides,
  };
}

/** A valid grant list for the bound capability at a given trust floor. */
export function grantsFor(capabilityId: string, overrides: Record<string, unknown> = {}): Record<string, unknown>[] {
  return [
    {
      capabilityId,
      hostFunctions: ['clock.read', 'log.write', 'world.read'],
      resourceScopes: [{ resource: 'world', access: 'read' }],
      ...overrides,
    },
  ];
}

/**
 * A valid extension manifest as loose JSON. `flavor` defaults to
 * `declarative` with a matching entry point; each flavor round-trip test
 * overrides both.
 */
export function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    extensionId: 'extension:stress-toolkit',
    version: '1.2.3',
    displayName: 'Stress Toolkit',
    description: 'Stress analysis contributions for structural workflows.',
    flavor: 'declarative',
    capabilityBindings: [
      { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'caret', version: '1.0.0' } },
    ],
    grants: grantsFor('engineering.stress-analysis'),
    entryPoints: [declarativeEntry()],
    contracts: [{ contractId: 'epoch.extension-sdk', contractVersion: '1.0.0' }],
    trustClass: 't2',
    license: 'Apache-2.0',
    dataHandling: { classification: 'sandbox-only' },
    sideEffects: [
      { kind: 'evidence-append', description: 'Appends solved-load evidence statements.' },
    ],
    ...overrides,
  };
}
