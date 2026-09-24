// Negative admission tests: unknown/retired capability bindings,
// version-unsatisfied constraints, digest tampering, trust-ceiling
// escalation by declaration, duplicate admission, and malformed
// envelopes of admission.
import { describe, expect, it } from 'vitest';
import { registerCapability, stressRegistry } from './helpers';
import { manifest, sealed, digestOf } from './helpers';
import { ExtensionSandboxHost } from '../src/index';

function hostWith(registrySetup?: (host: ExtensionSandboxHost) => void) {
  const registry = stressRegistry();
  const host = new ExtensionSandboxHost({ registry });
  registrySetup?.(host);
  return host;
}

const issuesOf = (
  result: { ok: boolean; error?: { code: string; issues?: readonly { path: string; message: string }[] } },
): readonly { path: string; message: string }[] | undefined => {
  if (result.ok) return undefined;
  const error = result.error as { code: string; issues?: readonly { path: string; message: string }[] };
  return error.code === 'validation' ? error.issues : undefined;
};

describe('admission: capability binding resolution (negative)', () => {
  it('rejects a binding to an UNKNOWN capability (unknown-capability)', () => {
    const host = hostWith();
    const result = host.admitExtension(
      sealed(
        manifest({
          capabilityBindings: [
            { capabilityId: 'engineering.does-not-exist', versionRange: { kind: 'exact', version: '1.0.0' } },
          ],
          grants: [],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unknown-capability');
    if (result.error.code !== 'unknown-capability') return;
    expect(result.error.path).toEqual(['capabilityBindings', 0, 'capabilityId']);
    expect(result.error.message).toContain('engineering.does-not-exist');
  });

  it('rejects a binding whose constraint no version satisfies (version-unsatisfied with details)', () => {
    const host = hostWith();
    const result = host.admitExtension(
      sealed(
        manifest({
          capabilityBindings: [
            { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'exact', version: '9.9.9' } },
          ],
          grants: [],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('version-unsatisfied');
    if (result.error.code !== 'version-unsatisfied') return;
    expect(result.error.constraint).toEqual({ kind: 'exact', version: '9.9.9' });
    expect(result.error.availableVersions).toEqual(['1.0.0', '1.2.3', '2.0.0']);
    expect(result.error.path).toEqual(['capabilityBindings', 0, 'versionRange']);
  });

  it('rejects a binding whose only satisfying version is RETIRED (lifecycle-conflict)', () => {
    const registry = stressRegistry();
    registerCapability(registry, 'engineering.retired-capability', '1.0.0', { lifecycle: 'retired' });
    const host = new ExtensionSandboxHost({ registry });
    const result = host.admitExtension(
      sealed(
        manifest({
          capabilityBindings: [
            { capabilityId: 'engineering.retired-capability', versionRange: { kind: 'caret', version: '1.0.0' } },
          ],
          grants: [],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('lifecycle-conflict');
    if (result.error.code !== 'lifecycle-conflict') return;
    expect(result.error.from).toBe('retired');
    expect(result.error.message).toContain('retired');
  });

  it('binds a deprecated capability anyway (deprecation is advisory)', () => {
    const registry = stressRegistry();
    registerCapability(registry, 'engineering.deprecated-capability', '1.0.0', { lifecycle: 'deprecated' });
    const host = new ExtensionSandboxHost({ registry });
    const result = host.admitExtension(
      sealed(
        manifest({
          capabilityBindings: [
            { capabilityId: 'engineering.deprecated-capability', versionRange: { kind: 'caret', version: '1.0.0' } },
          ],
          grants: [],
        }),
      ),
    );
    expect(result.ok).toBe(true);
  });
});

describe('admission: manifest integrity (negative)', () => {
  it('rejects a manifest whose claimed digest does not match its content (tamper detection)', () => {
    const host = hostWith();
    const tampered = manifest({ displayName: 'Totally Different Toolkit' });
    const result = host.admitExtension({ manifest: tampered, digest: digestOf(manifest()) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('digest-mismatch');
    if (result.error.code !== 'digest-mismatch') return;
    expect(result.error.path).toEqual(['digest']);
    expect(result.error.encountered).toBe(digestOf(manifest()));
    expect(result.error.expected).toBe(digestOf(tampered));
  });

  it('rejects a malformed claimed digest (not 64-hex) at the admission envelope', () => {
    const host = hostWith();
    const result = host.admitExtension({ manifest: manifest(), digest: 'nope' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)?.[0]?.path).toBe('digest');
  });

  it('rejects an invalid manifest with precise paths (validation)', () => {
    const host = hostWith();
    const result = host.admitExtension({ manifest: manifest({ version: '1.2' }), digest: digestOf(manifest()) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(issuesOf(result)?.[0]?.path).toBe('version');
  });

  it('rejects vendor fields at the admission boundary (strict mirror objects)', () => {
    const host = hostWith();
    const vendorManifest = { ...manifest(), provider: 'acme-cloud', engine: 'acme-fem' };
    const digest = digestOf(manifest());
    const result = host.admitExtension({ manifest: vendorManifest, digest });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    const paths = issuesOf(result)!.map((issue) => issue.path).sort();
    expect(paths).toEqual(['engine', 'provider']);
  });

  it('rejects trust-ceiling escalation by declaration (t0 requesting evidence.append)', () => {
    // The document is invalid, so no valid SDK seal exists — the host
    // validates it FIRST and rejects it independently (the SDK's own
    // validator rejects the same document; see the sdk-parity tests).
    const host = hostWith();
    const result = host.admitExtension({
      manifest: manifest({
        trustClass: 't0',
        grants: [
          {
            capabilityId: 'engineering.stress-analysis',
            hostFunctions: ['evidence.append', 'log.write'],
            resourceScopes: [{ resource: 'evidence', access: 'append' }],
          },
        ],
      }),
      digest: 'a'.repeat(64),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('grants.'));
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('exceeds the t0 trust-class grant ceiling');
    expect(issue!.path).toBe('grants.0.hostFunctions.0');
  });

  it('rejects a grant for an unbound capability at the admission boundary', () => {
    const host = hostWith();
    const result = host.admitExtension({
      manifest: manifest({
        grants: [{ capabilityId: 'engineering.other', hostFunctions: ['log.write'], resourceScopes: [] }],
      }),
      digest: 'a'.repeat(64),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = issuesOf(result)!.find((i) => i.path.startsWith('grants.'));
    expect(issue!.path).toBe('grants.0.capabilityId');
    expect(issue!.message).toContain('BOUND capabilities');
  });

  it('rejects duplicate admission of the same extension identity', () => {
    const host = hostWith();
    const first = host.admitExtension(sealed(manifest()));
    expect(first.ok).toBe(true);
    const second = host.admitExtension(sealed(manifest()));
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('validation');
    expect(issuesOf(second)![0]!.path).toBe('extensionId');
  });
});

describe('admission: malformed admission input (negative)', () => {
  it('rejects a non-object admission input', () => {
    const host = hostWith();
    const result = host.admitExtension('nope');
    expect(result.ok).toBe(false);
  });

  it('rejects an admission envelope with missing digest', () => {
    const host = hostWith();
    const result = host.admitExtension({ manifest: manifest() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(issuesOf(result)![0]!.path).toBe('digest');
  });
});

