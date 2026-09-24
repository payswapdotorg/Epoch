// Negative tests: malformed manifests, permission-boundary violations
// (grant escalation, cross-capability grants, trust ceilings), vendor
// fields, digest tampering, and non-canonical ordering.
import { describe, expect, it } from 'vitest';
import {
  computeExtensionManifestDigest,
  parseExtensionManifest,
  parseExtensionRegistration,
  type ExtensionSdkResult,
} from '../src/index';
import { manifest, grantsFor, declarativeEntry } from './helpers';


/** Typed accessor: the validation issues (undefined unless the error is validation). */
function issuesOf<T>(result: ExtensionSdkResult<T>): readonly { path: string; message: string }[] | undefined {
  if (result.ok) return undefined;
  return result.error.code === 'validation' ? result.error.issues : undefined;
}

const firstIssue = <T,>(result: ExtensionSdkResult<T>): { path: string; message: string } | undefined =>
  issuesOf(result)?.[0];

describe('extension manifest validation (negative)', () => {
  it('rejects a wrong schemaVersion discriminator with a precise path', () => {
    const result = parseExtensionManifest(manifest({ schemaVersion: 2 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(firstIssue(result)?.path).toBe('schemaVersion');
  });

  it('rejects a malformed extension id', () => {
    const result = parseExtensionManifest(
      manifest({ extensionId: 'stress-toolkit' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(firstIssue(result)?.path).toBe('extensionId');
  });

  it('rejects a malformed semver version ("1.2")', () => {
    const result = parseExtensionManifest(manifest({ version: '1.2' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(firstIssue(result)?.path).toBe('version');
  });

  it('rejects vendor/provider fields (strict objects, blocklist evidence)', () => {
    for (const vendorField of [
      { provider: 'acme-cloud' },
      { modelName: 'gpt-x' },
      { apiKey: 'sk-live' },
      { endpoint: 'https://vendor.example/api' },
      { framework: 'vendor-ui-kit' },
      { engine: 'acme-fem' },
    ]) {
      const result = parseExtensionManifest(manifest(vendorField));
      expect(result.ok, JSON.stringify(vendorField)).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('validation');
      expect(issuesOf(result)![0]!.message).toContain('Unrecognized key');
    }
  });

  it('rejects an empty capabilityBindings list (extensions are capability-scoped, lock rule 9)', () => {
    const result = parseExtensionManifest(manifest({ capabilityBindings: [] }));
    expect(result.ok).toBe(false);
  });

  it('rejects a grant for an UNBOUND capability (cross-capability access by declaration)', () => {
    const result = parseExtensionManifest(
      manifest({
        grants: grantsFor('engineering.other-capability'),
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('grants.'));
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('BOUND capabilities');
    expect(issue!.path).toBe('grants.0.capabilityId');
  });

  it('rejects grants above the trust-class ceiling (escalation by declaration, t0 read-only)', () => {
    const result = parseExtensionManifest(
      manifest({
        trustClass: 't0',
        grants: grantsFor('engineering.stress-analysis', {
          hostFunctions: ['evidence.append', 'log.write'],
          resourceScopes: [{ resource: 'evidence', access: 'append' }],
        }),
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('grants.'));
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('exceeds the t0 trust-class grant ceiling');
    expect(issue!.path).toBe('grants.0.hostFunctions.0');
  });

  it('rejects resource scopes above the trust-class ceiling with the scope path', () => {
    const result = parseExtensionManifest(
      manifest({
        trustClass: 't1',
        grants: grantsFor('engineering.stress-analysis', {
          hostFunctions: ['log.write', 'storage.read'],
          resourceScopes: [{ resource: 'storage', access: 'write' }],
        }),
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('grants.'));
    expect(issue).toBeDefined();
    expect(issue!.path).toBe('grants.0.resourceScopes.0');
    expect(issue!.message).toContain('exceeds the t1 trust-class grant ceiling');
  });

  it('rejects an ILLEGAL resource scope pair (world.write does not exist on the host surface)', () => {
    const result = parseExtensionManifest(
      manifest({
        trustClass: 't4',
        grants: grantsFor('engineering.stress-analysis', {
          hostFunctions: ['log.write', 'world.read'],
          resourceScopes: [{ resource: 'world', access: 'write' }],
        }),
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('grants.'));
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('not a legal resource scope');
  });

  it('rejects a grant with an empty hostFunctions list', () => {
    const result = parseExtensionManifest(
      manifest({ grants: grantsFor('engineering.stress-analysis', { hostFunctions: [] }) }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects entry-point/flavor mismatch with the precise entry-point path', () => {
    const result = parseExtensionManifest(
      manifest({ flavor: 'remote', entryPoints: [declarativeEntry()] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('entryPoints.'));
    expect(issue).toBeDefined();
    expect(issue!.path).toBe('entryPoints.0.kind');
    expect(issue!.message).toContain('does not match the manifest flavor "remote"');
  });

  it('rejects external-transfer data handling for a non-remote flavor', () => {
    const result = parseExtensionManifest(
      manifest({ dataHandling: { classification: 'external-transfer' } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('dataHandling'));
    expect(issue).toBeDefined();
    expect(issue!.path).toBe('dataHandling.classification');
  });

  it('rejects an entry point referencing an unknown flavor kind', () => {
    const result = parseExtensionManifest(
      manifest({ entryPoints: [{ kind: 'native', name: 'x', title: 'X' }] }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an empty entryPoints list', () => {
    const result = parseExtensionManifest(manifest({ entryPoints: [] }));
    expect(result.ok).toBe(false);
  });
});

describe('deterministic canonical ordering (negative: non-determinism asserted against)', () => {
  it('rejects UNSORTED capabilityBindings (permutation is an error, not a new revision)', () => {
    const result = parseExtensionManifest(
      manifest({
        capabilityBindings: [
          { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'caret', version: '1.0.0' } },
          { capabilityId: 'engineering.fem-solve', versionRange: { kind: 'exact', version: '1.0.0' } },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('capabilityBindings.'));
    expect(issue).toBeDefined();
    expect(issue!.path).toBe('capabilityBindings.1.capabilityId');
    expect(issue!.message).toContain('sorted ascending');
  });

  it('rejects DUPLICATE capabilityBindings', () => {
    const binding = { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'caret', version: '1.0.0' } };
    const result = parseExtensionManifest(
      manifest({ capabilityBindings: [binding, binding] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('capabilityBindings.'));
    expect(issue!.message).toContain('duplicate-free');
  });

  it('rejects UNSORTED grant hostFunctions', () => {
    const result = parseExtensionManifest(
      manifest({
        grants: grantsFor('engineering.stress-analysis', {
          hostFunctions: ['world.read', 'log.write'],
        }),
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('grants.'));
    expect(issue!.path).toBe('grants.0.hostFunctions.1');
  });

  it('rejects UNSORTED entryPoints by name', () => {
    const result = parseExtensionManifest(
      manifest({
        entryPoints: [
          { ...declarativeEntry(), name: 'zeta-contrib' },
          { ...declarativeEntry(), name: 'alpha-contrib' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('entryPoints.'));
    expect(issue!.path).toBe('entryPoints.1.name');
  });

  it('rejects UNSORTED declarative contributions', () => {
    const result = parseExtensionManifest(
      manifest({ entryPoints: [declarativeEntry({ contributions: ['world-type', 'mapping'] })] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('entryPoints.'));
    expect(issue!.path).toBe('entryPoints.0.contributions.1');
  });

  it('rejects UNSORTED contracts by contractId', () => {
    const result = parseExtensionManifest(
      manifest({
        contracts: [
          { contractId: 'epoch.extension-sdk', contractVersion: '1.0.0' },
          { contractId: 'epoch.agent-protocol', contractVersion: '1.0.0' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });
});

describe('manifest digest tampering (negative)', () => {
  it('rejects a registration whose claimed digest does not match the content (tamper detection)', () => {
    const document = manifest();
    const digest = computeExtensionManifestDigest(document as never);
    const tampered = manifest({ displayName: 'Totally Different Toolkit' });
    const result = parseExtensionRegistration({
      manifest: tampered,
      digest,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('digest-mismatch');
    if (result.error.code !== 'digest-mismatch') return;
    expect(result.error.encountered).toBe(digest);
    expect(result.error.expected).toBe(computeExtensionManifestDigest(tampered as never));
    expect(result.error.path).toEqual(['digest']);
  });

  it('rejects a malformed claimed digest (not 64-hex)', () => {
    const document = manifest();
    const result = parseExtensionRegistration({
      manifest: document,
      digest: 'deadbeef',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
  });
});
