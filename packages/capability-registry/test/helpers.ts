// Shared fixtures for the capability-registry tests. Builders return
// loose JSON objects so negative tests can corrupt single fields
// precisely (the W006 helpers pattern).
import {
  CAPABILITY_FABRIC_CATEGORIES,
  type ParameterSpec,
} from '@epoch/agent-protocol';
import { computeCapabilityManifestDigest } from '../src/index';
import type { CapabilityRegistration } from '../src/index';

export const ALL_CATEGORIES = [...CAPABILITY_FABRIC_CATEGORIES] as const;

/** A shared parameter spec (the agent-protocol shape). */
export const SPEC: ParameterSpec = {
  name: 'load-kn',
  kind: 'number',
  required: true,
  description: 'Rated load in kilonewtons.',
  unit: 'kN',
};

/** A valid provider-neutral descriptor as loose JSON. */
export function descriptor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    displayName: 'Stress Analysis',
    description: 'Linear static stress analysis over the reconstructed model.',
    inputs: [SPEC],
    outputs: [{ name: 'max-stress-mpa', kind: 'number', required: true, description: 'Peak von Mises stress.', unit: 'MPa' }],
    assumptions: ['Linear-elastic material behavior within rated load.'],
    ...overrides,
  };
}

/**
 * A valid capability manifest as loose JSON. `category` defaults to
 * `simulation`; every category is exercised by the round-trip tests.
 */
export function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    capabilityId: 'engineering.stress-analysis',
    category: 'simulation',
    version: '1.2.3',
    descriptor: descriptor(),
    contracts: [{ contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' }],
    trust: { origin: 'first-party', curator: 'actor:epoch-core' },
    ...overrides,
  };
}

/** Seal a (possibly corrupted) manifest with the digest of OTHER content. */
export function sealedWithForeignDigest(
  manifestInput: Record<string, unknown>,
): CapabilityRegistration {
  const other = manifest({ ...manifestInput, descriptor: descriptor({ displayName: 'Other' }) });
  const sealed = seal(other);
  return {
    manifest: manifestInput as unknown as CapabilityRegistration['manifest'],
    digest: sealed.digest,
  };
}

/** Validate + seal a manifest, throwing if invalid (fixture integrity). */
export function seal(manifestInput: Record<string, unknown>): CapabilityRegistration {
  const asManifest = manifestInput as unknown as CapabilityRegistration['manifest'];
  return {
    manifest: asManifest,
    digest: computeCapabilityManifestDigest(asManifest),
  };
}

/** A full registration fixture (valid manifest, correctly sealed). */
export function registration(
  overrides: Record<string, unknown> = {},
): CapabilityRegistration {
  return seal(manifest(overrides));
}
