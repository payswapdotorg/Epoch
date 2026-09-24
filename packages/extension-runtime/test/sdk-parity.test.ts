// Cross-package parity with @epoch/extension-sdk (devDependency — NO
// runtime coupling): the mirrored vocabularies are member-for-member
// identical, SDK-sealed manifests flow through the runtime's mirror
// schema and admission end-to-end, and the same corruptions are
// rejected by both validators (the W006 evidence->W002 /
// W007 adapter-sdk parity pattern).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EXTENSION_FLAVORS as SDK_FLAVORS,
  EXTENSION_TRUST_CLASSES as SDK_TRUST_CLASSES,
  HOST_FUNCTION_DECLARATIONS as SDK_HOST_DECLARATIONS,
  HOST_FUNCTION_IDS as SDK_HOST_FUNCTIONS,
  HOST_LOG_LEVELS as SDK_LOG_LEVELS,
  TRUST_CLASS_GRANT_CEILINGS as SDK_CEILINGS,
  parseExtensionManifest,
  parseExtensionRegistration,
  sealExtensionManifest,
} from '@epoch/extension-sdk';
import {
  EXTENSION_FLAVORS,
  EXTENSION_TRUST_CLASSES,
  ExtensionSandboxHost,
  ExtensionManifestViewSchema,
  HOST_FUNCTION_IDS,
  HOST_FUNCTION_REQUIRED_SCOPES,
  HOST_LOG_LEVELS,
  TRUST_CLASS_GRANT_CEILINGS,
  fixedClock,
} from '../src/index';
import { manifest as manifestFixture, stressRegistry, digestOf } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHARED_WASM_FIXTURE = path.resolve(
  here,
  '../../../runtimes/wasm/test/fixtures/component-descriptor.fixture.json',
);

function remoteEntry(): Record<string, unknown> {
  return {
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
          inputs: [{ name: 'load-kn', kind: 'number', required: true, description: 'Rated load in kilonewtons.', unit: 'kN' }],
          outputs: [{ name: 'max-stress-mpa', kind: 'number', required: true, description: 'Peak von Mises stress.', unit: 'MPa' }],
        },
      ],
    },
  };
}

describe('vocabulary parity (runtime mirror vs @epoch/extension-sdk)', () => {
  it('host-function ids are member-for-member identical', () => {
    expect([...HOST_FUNCTION_IDS]).toEqual([...SDK_HOST_FUNCTIONS]);
  });

  it('the required-scope table matches the SDK host-function declarations', () => {
    for (const declaration of SDK_HOST_DECLARATIONS) {
      const mirrored = HOST_FUNCTION_REQUIRED_SCOPES[declaration.hostFunction];
      expect(mirrored, declaration.hostFunction).toBeDefined();
      if (declaration.requiredScope === null) {
        expect(mirrored).toBeNull();
      } else {
        expect(mirrored).toEqual(declaration.requiredScope);
      }
    }
    expect(Object.keys(HOST_FUNCTION_REQUIRED_SCOPES)).toHaveLength(SDK_HOST_DECLARATIONS.length);
  });

  it('trust-class grant ceilings are member-for-member identical (the boundary-relevant projection)', () => {
    const project = (ceiling: { trustClass: string; hostFunctions: readonly string[]; resourceScopes: readonly unknown[] }) => ({
      trustClass: ceiling.trustClass,
      hostFunctions: [...ceiling.hostFunctions],
      resourceScopes: ceiling.resourceScopes.map((scope) => ({ ...(scope as object) })),
    });
    expect(TRUST_CLASS_GRANT_CEILINGS.map(project)).toEqual(SDK_CEILINGS.map(project));
  });

  it('flavors, trust classes, and log levels are identical', () => {
    expect([...EXTENSION_FLAVORS]).toEqual([...SDK_FLAVORS]);
    expect([...EXTENSION_TRUST_CLASSES]).toEqual([...SDK_TRUST_CLASSES]);
    expect([...HOST_LOG_LEVELS]).toEqual([...SDK_LOG_LEVELS]);
  });
});

describe('manifest fixture parity (SDK validator vs runtime mirror)', () => {
  it('SDK-valid fixtures parse under the runtime mirror (structural compatibility)', () => {
    const fixtures = [
      manifestFixture(),
      manifestFixture({ flavor: 'remote', entryPoints: [remoteEntry()] }),
      manifestFixture({ grants: [] }),
    ];
    for (const [index, fixture] of fixtures.entries()) {
      const sdkResult = parseExtensionManifest(fixture);
      const runtimeResult = ExtensionManifestViewSchema.safeParse(fixture);
      expect(sdkResult.ok, `sdk ${index}`).toBe(true);
      expect(runtimeResult.success, `runtime ${index}`).toBe(true);
    }
  });

  it('the same corruptions are rejected by BOTH validators', () => {
    const corruptions: Array<[string, Record<string, unknown>]> = [
      ['wrong schemaVersion', manifestFixture({ schemaVersion: 2 })],
      ['malformed version', manifestFixture({ version: '1.2' })],
      ['grant for unbound capability', manifestFixture({ grants: [{ capabilityId: 'engineering.other', hostFunctions: ['log.write'], resourceScopes: [] }] })],
      ['trust ceiling exceeded', manifestFixture({ trustClass: 't0', grants: [{ capabilityId: 'engineering.stress-analysis', hostFunctions: ['evidence.append', 'log.write'], resourceScopes: [{ resource: 'evidence', access: 'append' }] }] })],
      ['unsorted bindings', manifestFixture({ capabilityBindings: [{ capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'exact', version: '1.0.0' } }, { capabilityId: 'engineering.fem-solve', versionRange: { kind: 'exact', version: '1.0.0' } }] })],
      ['vendor field', { ...manifestFixture(), provider: 'acme-cloud' }],
    ];
    for (const [label, corrupted] of corruptions) {
      const sdkResult = parseExtensionManifest(corrupted);
      const runtimeResult = ExtensionManifestViewSchema.safeParse(corrupted);
      expect(sdkResult.ok, `sdk rejects: ${label}`).toBe(false);
      expect(runtimeResult.success, `runtime rejects: ${label}`).toBe(false);
    }
  });

  it('an SDK-sealed registration admits end-to-end through the runtime host', () => {
    const sealed = sealExtensionManifest(manifestFixture());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const host = new ExtensionSandboxHost({ registry: stressRegistry(), clock: fixedClock() });
    const admitted = host.admitExtension(sealed.value);
    expect(admitted.ok).toBe(true);
  });

  it('a digest-tampered envelope is rejected by BOTH the SDK parse and the runtime admission', () => {
    const tampered = manifestFixture({ displayName: 'Impostor Toolkit' });
    const digest = digestOf(manifestFixture());
    const sdkParse = parseExtensionRegistration({ manifest: tampered, digest });
    expect(sdkParse.ok).toBe(false);
    if (!sdkParse.ok) {
      expect(sdkParse.error.code).toBe('digest-mismatch');
    }
    const host = new ExtensionSandboxHost({ registry: stressRegistry(), clock: fixedClock() });
    const admitted = host.admitExtension({ manifest: tampered, digest });
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('digest-mismatch');
  });

  it('the shared committed wasm fixture parses under the runtime mirror (author/host/SDK three-way anchor)', () => {
    const fixture = JSON.parse(readFileSync(SHARED_WASM_FIXTURE, 'utf8')) as unknown;
    const wasmManifest = manifestFixture({
      flavor: 'wasm',
      entryPoints: [
        {
          kind: 'wasm',
          name: 'stress-render',
          title: 'Stress renderer component',
          component: fixture,
        },
      ],
    });
    const runtimeResult = ExtensionManifestViewSchema.safeParse(wasmManifest);
    expect(runtimeResult.success).toBe(true);
    const sdkResult = parseExtensionManifest(wasmManifest);
    expect(sdkResult.ok).toBe(true);
  });
});
