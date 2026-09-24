// Positive tests: manifest round-trip per extension flavor, content
// addressing, deterministic serialization, capability bindings, and
// grant declaration.
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  computeExtensionManifestDigest,
  parseExtensionManifest,
  parseExtensionRegistration,
  sealExtensionManifest,
  serializeExtensionManifest,
  verifyExtensionManifestDigest,
} from '../src/index';
import { manifest, declarativeEntry, uiEntry, wasmEntry, remoteEntry, grantsFor } from './helpers';

describe('extension manifest validation (positive, per flavor)', () => {
  it.each([
    ['declarative', declarativeEntry()],
    ['ui', uiEntry()],
    ['wasm', wasmEntry()],
    ['remote', remoteEntry()],
  ] as const)('accepts a valid %s-flavor manifest', (flavor, entry) => {
    const document = manifest({ flavor, entryPoints: [entry] });
    const result = parseExtensionManifest(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flavor).toBe(flavor);
    expect(result.value.entryPoints[0]!.kind).toBe(flavor);
  });

  it('accepts a manifest with an empty grants list (least privilege allows zero host access)', () => {
    const result = parseExtensionManifest(manifest({ grants: [] }));
    expect(result.ok).toBe(true);
  });

  it('accepts a manifest with empty contracts, empty side effects, and no description', () => {
    const result = parseExtensionManifest(
      manifest({ contracts: [], sideEffects: [], description: undefined }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts every trust class with grants within its ceiling', () => {
    const ceilings: Record<string, string[]> = {
      t0: ['clock.read', 'log.write'],
      t1: ['clock.read', 'evidence.append', 'log.write'],
      t2: ['capability.invoke', 'clock.read', 'log.write'],
      t3: ['clock.read', 'log.write', 'storage.write'],
      t4: ['clock.read', 'log.write', 'storage.read', 'world.read'],
    };
    for (const [trustClass, hostFunctions] of Object.entries(ceilings)) {
      const result = parseExtensionManifest(
        manifest({
          trustClass,
          grants: grantsFor('engineering.stress-analysis', {
            hostFunctions,
            resourceScopes:
              hostFunctions.includes('world.read') || hostFunctions.includes('storage.read')
                ? [{ resource: 'world', access: 'read' }]
                : hostFunctions.includes('evidence.append')
                  ? [{ resource: 'evidence', access: 'append' }]
                  : hostFunctions.includes('capability.invoke')
                    ? [{ resource: 'capability', access: 'invoke' }]
                    : hostFunctions.includes('storage.write')
                      ? [{ resource: 'storage', access: 'write' }]
                      : [],
          }),
        }),
      );
      expect(result.ok, trustClass).toBe(true);
    }
  });

  it('accepts external-transfer data handling for the remote flavor', () => {
    const result = parseExtensionManifest(
      manifest({
        flavor: 'remote',
        entryPoints: [remoteEntry()],
        dataHandling: { classification: 'external-transfer', notes: 'Solver processes meshes server-side.' },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts multiple capability bindings and grants in canonical order', () => {
    const result = parseExtensionManifest(
      manifest({
        capabilityBindings: [
          { capabilityId: 'engineering.fem-solve', versionRange: { kind: 'exact', version: '1.0.0' } },
          { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'caret', version: '1.0.0' } },
        ],
        grants: [
          { capabilityId: 'engineering.fem-solve', hostFunctions: ['log.write'], resourceScopes: [] },
          { capabilityId: 'engineering.stress-analysis', hostFunctions: ['clock.read', 'log.write'], resourceScopes: [] },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('content addressing and tamper detection (positive)', () => {
  it('seal/verify round-trips a valid manifest', () => {
    const sealed = sealExtensionManifest(manifest());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const verified = verifyExtensionManifestDigest(sealed.value);
    expect(verified.ok).toBe(true);
  });

  it('parseExtensionRegistration admits a correctly sealed envelope', () => {
    const sealed = sealExtensionManifest(manifest());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const parsed = parseExtensionRegistration(sealed.value);
    expect(parsed.ok).toBe(true);
  });

  it('the manifest digest equals the SHA-256 of the canonical JSON', () => {
    const document = manifest();
    const digest = computeExtensionManifestDigest(document as never);
    expect(digest).toBe(canonicalDigest(document as unknown as Parameters<typeof canonicalDigest>[0]));
  });

  it('deterministic serialization: key-order permutations serialize identically', () => {
    const left = manifest();
    const right = {
      license: 'Apache-2.0',
      sideEffects: left.sideEffects,
      dataHandling: left.dataHandling,
      trustClass: left.trustClass,
      contracts: left.contracts,
      entryPoints: left.entryPoints,
      grants: left.grants,
      capabilityBindings: left.capabilityBindings,
      flavor: left.flavor,
      description: left.description,
      displayName: left.displayName,
      version: left.version,
      extensionId: left.extensionId,
      schemaVersion: left.schemaVersion,
    };
    expect(serializeExtensionManifest(left as never)).toBe(serializeExtensionManifest(right as never));
    expect(computeExtensionManifestDigest(left as never)).toBe(computeExtensionManifestDigest(right as never));
  });

  it('serialization round-trips through JSON.parse with equal digests', () => {
    const document = manifest();
    const text = serializeExtensionManifest(document as never);
    const reparsed = JSON.parse(text) as Record<string, unknown>;
    const result = parseExtensionManifest(reparsed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(computeExtensionManifestDigest(result.value)).toBe(computeExtensionManifestDigest(document as never));
  });
});
