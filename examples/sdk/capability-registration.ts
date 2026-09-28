/**
 * examples/sdk — capability registration over the REAL @epoch/capability-registry
 * (W007) public API (W035).
 *
 * The example a developer follows to REGISTER a capability: build a typed
 * manifest (identity, category, semver version, input/output descriptors,
 * trust origin), compute its canonical content digest, register it in the
 * in-memory registry, resolve it at the exact version, and observe the
 * lifecycle vocabulary. The registry is consumed through its public API —
 * no internals, no mocks; failures throw loudly with the kernel's typed
 * error.
 */
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
  type CapabilityRecord,
  type CapabilityRegistration,
} from '@epoch/capability-registry';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { CAPABILITY_ID } from './shared';

/** The manifest the example registers (loose JSON — the admission path validates). */
export function exampleCapabilityManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    capabilityId: CAPABILITY_ID,
    category: 'simulation',
    version: '1.2.3',
    descriptor: {
      displayName: 'Stress Analysis',
      description: 'Linear static stress analysis.',
      inputs: [
        {
          name: 'load-kn',
          kind: 'number',
          required: true,
          description: 'Rated load in kilonewtons.',
          unit: 'kN',
        },
      ],
      outputs: [
        {
          name: 'max-stress-mpa',
          kind: 'number',
          required: true,
          description: 'Peak von Mises stress.',
          unit: 'MPa',
        },
      ],
      assumptions: ['Linear-elastic behavior.'],
    },
    contracts: [],
    trust: { origin: 'first-party' },
  };
}

/** The typed outcome of the capability-registration example. */
export interface CapabilityRegistrationExample {
  readonly capabilityId: string;
  readonly version: string;
  readonly manifestDigest: string;
  readonly registeredLifecycle: string;
  readonly resolvedLifecycle: string;
  readonly registeredCount: number;
}

/** Run the example (pure — same result every run). */
export function runCapabilityRegistrationExample(): CapabilityRegistrationExample {
  const registry = new CapabilityRegistry();
  const manifest = exampleCapabilityManifest();
  const registration: CapabilityRegistration = {
    manifest: manifest as unknown as CapabilityRegistration['manifest'],
    digest: computeCapabilityManifestDigest(manifest as unknown as CapabilityRegistration['manifest']),
  };
  const registered = registry.register(registration);
  if (!registered.ok) {
    throw new Error(`registration failed: ${JSON.stringify(registered.error)}`);
  }

  const resolved = registry.get({ capabilityId: CAPABILITY_ID, version: '1.2.3' });
  if (!resolved.ok) {
    throw new Error(`resolution failed: ${JSON.stringify(resolved.error)}`);
  }
  const record: CapabilityRecord = resolved.value;

  const listed = registry.list();
  if (listed.length !== 1) {
    throw new Error(`expected exactly one registered capability, found ${listed.length}`);
  }

  return {
    capabilityId: record.manifest.capabilityId,
    version: record.manifest.version,
    manifestDigest: record.manifestDigest,
    registeredLifecycle: registered.value.lifecycle,
    resolvedLifecycle: record.lifecycle,
    registeredCount: listed.length,
  };
}

/** The canonical digest projection (the determinism gate). */
export function capabilityRegistrationDigestProjection(): string {
  const outcome = runCapabilityRegistrationExample();
  return canonicalDigest(outcome as unknown as JsonValue);
}
