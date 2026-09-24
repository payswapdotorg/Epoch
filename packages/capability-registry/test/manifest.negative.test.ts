// Negative tests: every broken-manifest class the registry must reject —
// unknown categories, malformed versions, vendor/provider field
// smuggling (strict objects + blocklist), schema violations with precise
// paths, version-skew, digest tampering, and duplicate contract pins.
import { describe, expect, it } from 'vitest';
import type { RegistryError, RegistryResult } from '../src/index';
import {
  parseCapabilityManifest,
  parseCapabilityRecord,
  sealCapabilityManifest,
  verifyManifestDigest,
} from '../src/index';
import { manifest, sealedWithForeignDigest, seal } from './helpers';

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: RegistryResult<T>): RegistryError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

function validationIssues(error: RegistryError): readonly { path: string; message: string }[] {
  expect(error.code).toBe('validation');
  if (error.code !== 'validation') throw new Error('expected a validation error');
  return error.issues;
}

describe('unknown category (negative)', () => {
  it('rejects a category outside the Capability Fabric list', () => {
    const issues = validationIssues(
      failureOf(parseCapabilityManifest(manifest({ category: 'orchestration' }))),
    );
    expect(issues.some((issue) => issue.path === 'category')).toBe(true);
  });

  it('rejects a vendor-shaped pseudo-category', () => {
    expect(parseCapabilityManifest(manifest({ category: 'openai-simulator' })).ok).toBe(false);
  });
});

describe('malformed version (negative)', () => {
  it.each(['1.2', '1.2.3.4', 'v1.2.3', '1.2.3-beta', '', 'one.two.three'])(
    'rejects malformed version %s',
    (version) => {
      const issues = validationIssues(failureOf(parseCapabilityManifest(manifest({ version }))));
      expect(issues.some((issue) => issue.path === 'version'), version).toBe(true);
    },
  );

  it('rejects a malformed contract reference version', () => {
    const issues = validationIssues(
      failureOf(
        parseCapabilityManifest(
          manifest({
            contracts: [{ contractId: 'epoch.simulation-protocol', contractVersion: '1' }],
          }),
        ),
      ),
    );
    expect(issues.some((issue) => issue.path === 'contracts.0.contractVersion')).toBe(true);
  });
});

describe('vendor/provider field smuggling (negative — neutrality boundary)', () => {
  it('rejects an unknown top-level provider field', () => {
    const issues = validationIssues(
      failureOf(parseCapabilityManifest(manifest({ provider: 'acme-cloud' }))),
    );
    expect(issues.some((issue) => issue.message.toLowerCase().includes('provider'))).toBe(true);
  });

  it('rejects vendor fields inside the descriptor', () => {
    const result = parseCapabilityManifest(
      manifest({
        descriptor: {
          displayName: 'X',
          apiKey: 'sk-123',
          inputs: [],
          outputs: [],
          assumptions: [],
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects vendor fields inside the trust surface', () => {
    const result = parseCapabilityManifest(
      manifest({ trust: { origin: 'community', vendor: 'acme' } }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects vendor fields inside a contract reference', () => {
    const result = parseCapabilityManifest(
      manifest({
        contracts: [
          {
            contractId: 'epoch.simulation-protocol',
            contractVersion: '1.0.0',
            apiUrl: 'https://vendor.example',
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });
});

describe('schema violations with precise paths (negative)', () => {
  it('reports the exact dotted path of a nested violation', () => {
    const issues = validationIssues(
      failureOf(
        parseCapabilityManifest(
          manifest({
            descriptor: {
              displayName: 'X',
              inputs: [{ name: 'BadName', kind: 'number', required: true, description: 'x' }],
              outputs: [],
              assumptions: [],
            },
          }),
        ),
      ),
    );
    expect(issues.some((issue) => issue.path === 'descriptor.inputs.0.name')).toBe(true);
  });

  it('rejects version discriminator skew with a path at schemaVersion', () => {
    const issues = validationIssues(
      failureOf(parseCapabilityManifest(manifest({ schemaVersion: 2 }))),
    );
    expect(issues.some((issue) => issue.path === 'schemaVersion')).toBe(true);
  });

  it('rejects a non-qualified capability id', () => {
    const issues = validationIssues(
      failureOf(parseCapabilityManifest(manifest({ capabilityId: 'stress-analysis' }))),
    );
    expect(issues.some((issue) => issue.path === 'capabilityId')).toBe(true);
  });

  it('rejects a malformed attestation digest', () => {
    const issues = validationIssues(
      failureOf(
        parseCapabilityManifest(manifest({ trust: { origin: 'first-party', attestationDigest: 'XYZ' } })),
      ),
    );
    expect(issues.some((issue) => issue.path === 'trust.attestationDigest')).toBe(true);
  });

  it('rejects a duplicate contract id pin (one contract id, one version)', () => {
    const result = parseCapabilityManifest(
      manifest({
        contracts: [
          { contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' },
          { contractId: 'epoch.simulation-protocol', contractVersion: '1.1.0' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });
});

describe('digest tampering (negative)', () => {
  it('sealCapabilityManifest is total and rejects invalid manifests', () => {
    expect(sealCapabilityManifest(manifest({ category: 'nope' })).ok).toBe(false);
  });

  it('a serialized record with a tampered manifest fails digest verification', () => {
    const sealed = seal(manifest());
    const record = {
      schemaVersion: 1,
      manifest: sealed.manifest,
      lifecycle: 'registered',
      manifestDigest: sealed.digest,
    };
    // Tamper: same digest, different content behind it.
    const tampered = {
      ...record,
      manifest: { ...sealed.manifest, version: '9.9.9' },
    };
    const error = failureOf(parseCapabilityRecord(tampered));
    expect(error.code).toBe('digest-mismatch');
    if (error.code !== 'digest-mismatch') return;
    expect(error.path).toEqual(['manifestDigest']);
    expect(error.expected).not.toBe(error.encountered);
  });

  it('a registration sealed with a foreign digest is rejected by verification', () => {
    const foreign = sealedWithForeignDigest(manifest());
    // The manifest itself is valid...
    expect(sealCapabilityManifest(foreign.manifest).ok).toBe(true);
    // ...but its claimed digest does not match its content.
    const error = failureOf(verifyManifestDigest(foreign));
    expect(error.code).toBe('digest-mismatch');
  });
});
