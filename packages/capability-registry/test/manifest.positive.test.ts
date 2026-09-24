// Positive tests: manifest/record validation and content addressing.
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
  parseCapabilityManifest,
  parseCapabilityRecord,
  sealCapabilityManifest,
} from '../src/index';
import { ALL_CATEGORIES, descriptor, manifest, seal } from './helpers';

describe('capability manifest validation (positive)', () => {
  it.each(ALL_CATEGORIES)('accepts a valid %s-category manifest', (category) => {
    const result = parseCapabilityManifest(
      manifest({ category, capabilityId: `engineering.fixture-${category.replace(/-/g, '')}` }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.category).toBe(category);
  });

  it('accepts a manifest with an empty contracts list (category contract not yet frozen)', () => {
    const result = parseCapabilityManifest(manifest({ contracts: [] }));
    expect(result.ok).toBe(true);
  });

  it('accepts a manifest with empty descriptor parameter lists and assumptions', () => {
    const result = parseCapabilityManifest(
      manifest({ descriptor: { displayName: 'Bare', inputs: [], outputs: [], assumptions: [] } }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts every documented origin class', () => {
    for (const origin of [
      'first-party',
      'community',
      'external-software',
      'provisional-document-derived',
    ] as const) {
      const result = parseCapabilityManifest(
        manifest({ trust: { origin, attestationDigest: 'a'.repeat(64) } }),
      );
      expect(result.ok, origin).toBe(true);
    }
  });
});

describe('manifest content addressing (positive)', () => {
  it('the manifest digest is the canonical-JSON SHA-256 of the manifest', () => {
    const sealed = seal(manifest());
    expect(sealed.digest).toBe(canonicalDigest(sealed.manifest as never));
  });

  it('equivalent manifests (different key order) produce the identical digest', () => {
    const left = seal(manifest());
    const right = seal({
      trust: { curator: 'actor:epoch-core', origin: 'first-party' },
      contracts: [{ contractVersion: '1.0.0', contractId: 'epoch.simulation-protocol' }],
      descriptor: descriptor({
        description: 'Linear static stress analysis over the reconstructed model.',
      }),
      version: '1.2.3',
      category: 'simulation',
      capabilityId: 'engineering.stress-analysis',
      schemaVersion: 1,
    });
    expect(left.digest).toBe(right.digest);
  });

  it('sealCapabilityManifest recomputes the digest (total form)', () => {
    const sealed = sealCapabilityManifest(manifest());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.value.digest).toBe(computeCapabilityManifestDigest(sealed.value.manifest));
    expect(sealed.value.manifest.capabilityId).toBe('engineering.stress-analysis');
  });

  it('sealCapabilityManifest reports typed validation errors for invalid manifests', () => {
    const sealed = sealCapabilityManifest(manifest({ version: 'not-semver' }));
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
    if (sealed.error.code !== 'validation') return;
    expect(sealed.error.issues.some((issue) => issue.path === 'version')).toBe(true);
  });
});

describe('serialized record parse round-trip (positive)', () => {
  it('a registered record round-trips through parseCapabilityRecord', () => {
    const registry = new CapabilityRegistry();
    const registered = registry.register(seal(manifest()));
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    // JSON round-trip, then parse + digest verification.
    const serialized = JSON.parse(JSON.stringify(registered.value)) as unknown;
    const parsed = parseCapabilityRecord(serialized);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual(registered.value);
    expect(parsed.value.manifestDigest).toBe(registered.value.manifestDigest);
  });
});
