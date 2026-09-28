/**
 * examples/sdk — an extension manifest over the REAL @epoch/extension-sdk
 * (W008) public API (W035).
 *
 * The example a developer follows to AUTHOR an extension: build a
 * declarative-flavor manifest (identity, version, capability bindings
 * with version ranges, the explicit GRANT allow-list over the closed
 * host-function vocabulary, the declared trust class, license, data
 * handling classification and side effects), parse it through the SDK's
 * total admission path, compute its canonical content digest (the
 * exact-revision address), and round-trip verify it. The manifest binds
 * the capability the other examples registered.
 */
import {
  computeExtensionManifestDigest,
  parseExtensionManifest,
  sealExtensionManifest,
  verifyExtensionManifestDigest,
  type ExtensionManifest,
} from '@epoch/extension-sdk';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { CAPABILITY_ID } from './shared';

/** The declarative entry point the example extension contributes. */
export function exampleDeclarativeEntry(): Record<string, unknown> {
  return {
    kind: 'declarative',
    name: 'stress-ontology',
    title: 'Stress ontology contributions',
    contributions: ['mapping', 'world-type'],
  };
}

/** The extension manifest the example authors (loose JSON — the admission path validates). */
export function exampleExtensionManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    extensionId: 'extension:stress-toolkit',
    version: '1.2.3',
    displayName: 'Stress Toolkit',
    description: 'Stress analysis contributions for structural workflows.',
    flavor: 'declarative',
    capabilityBindings: [
      { capabilityId: CAPABILITY_ID, versionRange: { kind: 'caret', version: '1.0.0' } },
    ],
    grants: [
      {
        capabilityId: CAPABILITY_ID,
        hostFunctions: ['clock.read', 'log.write', 'world.read'],
        resourceScopes: [{ resource: 'world', access: 'read' }],
      },
    ],
    entryPoints: [exampleDeclarativeEntry()],
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

/** The typed outcome of the extension example. */
export interface ExtensionExample {
  readonly extensionId: string;
  readonly flavor: string;
  readonly trustClass: string;
  readonly grantCount: number;
  readonly hostFunctionsGranted: string[];
  readonly manifestDigest: string;
  readonly roundTripVerified: boolean;
}

/** Run the example (pure — same result every run). */
export function runExtensionExample(): ExtensionExample {
  const parsed = parseExtensionManifest(exampleExtensionManifest());
  if (!parsed.ok) {
    throw new Error(`manifest failed validation: ${parsed.error.message}`);
  }
  const manifest: ExtensionManifest = parsed.value;

  const manifestDigest = computeExtensionManifestDigest(manifest);
  const sealed = sealExtensionManifest(exampleExtensionManifest());
  if (!sealed.ok) {
    throw new Error(`sealing failed: ${sealed.error.message}`);
  }
  const verified = verifyExtensionManifestDigest(sealed.value);
  if (!verified.ok) {
    throw new Error(`round-trip verification failed: ${verified.error.message}`);
  }

  return {
    extensionId: manifest.extensionId,
    flavor: manifest.flavor,
    trustClass: manifest.trustClass,
    grantCount: manifest.grants.length,
    hostFunctionsGranted: [...manifest.grants[0]!.hostFunctions],
    manifestDigest,
    roundTripVerified: true,
  };
}

/** The canonical digest projection (the determinism gate). */
export function extensionDigestProjection(): string {
  const outcome = runExtensionExample();
  return canonicalDigest(outcome as unknown as JsonValue);
}
