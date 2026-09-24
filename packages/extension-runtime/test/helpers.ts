// Shared fixtures for the extension-runtime tests: a live capability
// registry with registered capabilities (the genuine runtime
// composition), plus extension-manifest builders as loose JSON.
import {
  CapabilityRegistry,
  sealCapabilityManifest,
  type CapabilityRegistration,
} from '@epoch/capability-registry';
import { computeExtensionManifestDigest, sealExtensionManifest } from '@epoch/extension-sdk';

/** Register one capability version and return the sealed registration. */
export function registerCapability(
  registry: CapabilityRegistry,
  capabilityId: string,
  version: string,
  options: { category?: string; lifecycle?: 'deprecated' | 'retired' } = {},
): CapabilityRegistration {
  const manifest = {
    schemaVersion: 1,
    capabilityId,
    category: options.category ?? 'simulation',
    version,
    descriptor: {
      displayName: 'Stress Analysis',
      inputs: [],
      outputs: [],
      assumptions: [],
    },
    contracts: [],
    trust: { origin: 'first-party' as const },
  };
  const sealed = sealCapabilityManifest(manifest);
  if (!sealed.ok) {
    throw new Error(`capability fixture failed to seal: ${sealed.error.message}`);
  }
  const registered = registry.register(sealed.value);
  if (!registered.ok) {
    throw new Error(`capability fixture failed to register: ${registered.error.message}`);
  }
  if (options.lifecycle === 'deprecated') {
    registry.deprecate({ capabilityId, version });
  }
  if (options.lifecycle === 'retired') {
    registry.retire({ capabilityId, version });
  }
  return sealed.value;
}

/** A registry pre-loaded with the stress-analysis capability (1.0.0 .. 2.0.0). */
export function stressRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  for (const version of ['1.0.0', '1.2.3', '2.0.0']) {
    registerCapability(registry, 'engineering.stress-analysis', version);
  }
  return registry;
}

/** A valid extension manifest as loose JSON (declarative flavor, t2). */
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
    grants: [
      {
        capabilityId: 'engineering.stress-analysis',
        hostFunctions: ['clock.read', 'log.write', 'world.read'],
        resourceScopes: [{ resource: 'world', access: 'read' }],
      },
    ],
    entryPoints: [
      {
        kind: 'declarative',
        name: 'world-ontology',
        title: 'World ontology contributions',
        contributions: ['mapping', 'world-type'],
      },
    ],
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

/** Seal a manifest document with its true digest (devDep helper). */
export function sealed(manifestInput: Record<string, unknown>): { manifest: unknown; digest: string } {
  const result = sealExtensionManifest(manifestInput);
  if (!result.ok) {
    throw new Error(`manifest fixture failed to seal: ${result.error.message}`);
  }
  return { manifest: result.value.manifest, digest: result.value.digest };
}

/** A canonical manifest digest (devDep helper). */
export function digestOf(manifestInput: Record<string, unknown>): string {
  return computeExtensionManifestDigest(manifestInput as never);
}

/** One typed invocation envelope as loose JSON. */
export function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    envelopeId: 'inv-0001',
    extensionId: 'extension:stress-toolkit',
    capabilityId: 'engineering.stress-analysis',
    hostFunction: 'log.write',
    payload: { level: 'info', message: 'computed load case' },
    ...overrides,
  };
}

/** A permitted world.read envelope. */
export function worldReadEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return envelope({
    hostFunction: 'world.read',
    payload: { entityRefs: ['world:beam-42'] },
    ...overrides,
  });
}
