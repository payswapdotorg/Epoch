// Negative enforcement tests: the authority/security boundary itself —
// permission denials (undeclared grants, missing scopes,
// cross-capability access), sandbox violations (unbound capability,
// session identity mismatch), retired sessions, payload contract
// violations, malformed envelopes, and grant-broadening attempts.
import { describe, expect, it } from 'vitest';
import { sealExtensionManifest } from '@epoch/extension-sdk';
import { ExtensionSandboxHost, fixedClock } from '../src/index';
import { registerCapability, stressRegistry } from './helpers';
import { manifest, sealed, envelope } from './helpers';

const GRANTS_READ_ONLY = [
  {
    capabilityId: 'engineering.stress-analysis',
    hostFunctions: ['clock.read', 'log.write', 'world.read'],
    resourceScopes: [{ resource: 'world', access: 'read' }],
  },
];

function buildSession(grants: unknown[], options: { extraBinding?: string } = {}) {
  const registry = stressRegistry();
  if (options.extraBinding !== undefined) {
    registerCapability(registry, options.extraBinding, '1.0.0');
  }
  const host = new ExtensionSandboxHost({ registry, clock: fixedClock('2026-07-01T12:00:00.000Z') });
  const baseBindings = manifest().capabilityBindings as {
    capabilityId: string;
    versionRange: unknown;
  }[];
  const extraBinding =
    options.extraBinding === undefined
      ? []
      : [{ capabilityId: options.extraBinding, versionRange: { kind: 'exact', version: '1.0.0' } }];
  const bindings = [...extraBinding, ...baseBindings].sort((a, b) =>
    a.capabilityId < b.capabilityId ? -1 : 1,
  );
  const admitted = host.admitExtension(
    sealed(manifest({ capabilityBindings: bindings, grants: grants as never })),
  );
  if (!admitted.ok) {
    throw new Error(`fixture session failed to admit: ${admitted.error.message}`);
  }
  return { host, session: admitted.value };
}

describe('permission denials (negative — the allow-list boundary)', () => {
  it('denies an UNDECLARED host function with a typed permission-denied error', () => {
    const { session } = buildSession(GRANTS_READ_ONLY);
    const result = session.invoke(
      envelope({ hostFunction: 'storage.read', payload: { key: 'cache.x' } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('permission-denied');
    if (result.error.code !== 'permission-denied') return;
    expect(result.error.reason).toBe('undeclared-host-function');
    expect(result.error.hostFunction).toBe('storage.read');
    expect(result.error.capabilityId).toBe('engineering.stress-analysis');
    expect(result.error.path).toEqual(['hostFunction']);
    expect(result.error.message).toContain('anything not explicitly granted is denied');
  });

  it('denies a DECLARED function whose required resource scope is missing', () => {
    const { session } = buildSession([
      {
        capabilityId: 'engineering.stress-analysis',
        hostFunctions: ['log.write', 'world.read'],
        resourceScopes: [],
      },
    ]);
    const result = session.invoke(
      envelope({ hostFunction: 'world.read', payload: { entityRefs: ['world:beam-42'] } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('permission-denied');
    if (result.error.code !== 'permission-denied') return;
    expect(result.error.reason).toBe('undeclared-resource-scope');
    expect(result.error.message).toContain('requires the resource scope "world.read"');
  });

  it('denies CROSS-CAPABILITY access: the function is granted only under another binding', () => {
    const { session } = buildSession(
      [
        {
          // Granted only for the SECOND bound capability.
          capabilityId: 'engineering.mesh-prep',
          hostFunctions: ['storage.read'],
          resourceScopes: [{ resource: 'storage', access: 'read' }],
        },
      ],
      { extraBinding: 'engineering.mesh-prep' },
    );
    const result = session.invoke(
      envelope({
        capabilityId: 'engineering.stress-analysis',
        hostFunction: 'storage.read',
        payload: { key: 'cache.x' },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('permission-denied');
    if (result.error.code !== 'permission-denied') return;
    expect(result.error.reason).toBe('cross-capability-access');
    expect(result.error.message).toContain(
      'only under capability "engineering.mesh-prep", not under "engineering.stress-analysis"',
    );
    expect(result.error.message).toContain('grants are capability-scoped');
  });
});

describe('sandbox violations (negative — boundary escapes)', () => {
  it('rejects an envelope naming an UNBOUND capability (reaching outside the declared scope)', () => {
    const { session } = buildSession(GRANTS_READ_ONLY);
    const result = session.invoke(
      envelope({ capabilityId: 'engineering.never-bound', hostFunction: 'log.write' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sandbox-violation');
    if (result.error.code !== 'sandbox-violation') return;
    expect(result.error.detail).toBe('unbound-capability');
    expect(result.error.path).toEqual(['capabilityId']);
    expect(result.error.message).toContain('never bound');
  });

  it('rejects an envelope claiming ANOTHER extension identity (session identity mismatch)', () => {
    const { session } = buildSession(GRANTS_READ_ONLY);
    const result = session.invoke(
      envelope({ extensionId: 'extension:someone-else', hostFunction: 'log.write' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sandbox-violation');
    if (result.error.code !== 'sandbox-violation') return;
    expect(result.error.detail).toBe('session-identity-mismatch');
    expect(result.error.path).toEqual(['extensionId']);
    expect(result.error.message).toContain('a session serves exactly one extension identity');
  });

  it('rejects invocations against a RETIRED session (lifecycle-conflict)', () => {
    const { host, session } = buildSession(GRANTS_READ_ONLY);
    host.retireExtension('extension:stress-toolkit');
    const result = session.invoke(envelope());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('lifecycle-conflict');
    if (result.error.code !== 'lifecycle-conflict') return;
    expect(result.error.from).toBe('retired');
    expect(result.error.message).toContain('retired sessions do not serve invocations');
  });

  it('a grant-BROADENED variant of an admitted manifest cannot smuggle in wider access (tamper detection)', () => {
    // The manifest is content-addressed: the broadened variant has a
    // different digest, so presenting it under the ORIGINAL digest is a
    // typed digest-mismatch at the boundary — escalation by envelope
    // forgery is inexpressible.
    const host = new ExtensionSandboxHost({ registry: stressRegistry(), clock: fixedClock() });
    const sealedOriginal = sealExtensionManifest(manifest());
    if (!sealedOriginal.ok) throw new Error('fixture failed to seal');
    const admitted = host.admitExtension(sealedOriginal.value);
    expect(admitted.ok).toBe(true);
    // A VALID but broadened manifest (adds storage.read within the t2
    // ceiling): presenting it under the ORIGINAL digest is forgery.
    const broadened = manifest({
      grants: [
        {
          capabilityId: 'engineering.stress-analysis',
          hostFunctions: ['clock.read', 'log.write', 'storage.read', 'world.read'],
          resourceScopes: [
            { resource: 'storage', access: 'read' },
            { resource: 'world', access: 'read' },
          ],
        },
      ],
    });
    const tampered = host.admitExtension({ manifest: broadened, digest: sealedOriginal.value.digest });
    expect(tampered.ok).toBe(false);
    if (tampered.ok) return;
    expect(tampered.error.code).toBe('digest-mismatch');
    if (tampered.error.code !== 'digest-mismatch') return;
    expect(tampered.error.message).toContain('never crosses the sandbox boundary');
  });

  it('the session allow-list stays frozen after admission (mutating the input document has no effect)', () => {
    const document = manifest();
    const sealedDocument = sealed(document);
    const registry = stressRegistry();
    const host = new ExtensionSandboxHost({ registry, clock: fixedClock() });
    const admitted = host.admitExtension(sealedDocument);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    // Escalation attempt: mutate the CALLER's document after admission.
    (document.grants as { hostFunctions: string[] }[])[0]!.hostFunctions.push('storage.write');
    const result = admitted.value.invoke(
      envelope({ hostFunction: 'storage.write', payload: { key: 'cache.x', value: 1 } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('permission-denied');
    if (result.error.code !== 'permission-denied') return;
    expect(result.error.reason).toBe('undeclared-host-function');
  });
});

describe('envelope validation (negative)', () => {
  it('rejects a malformed envelope with precise paths (validation)', () => {
    const { session } = buildSession(GRANTS_READ_ONLY);
    const result = session.invoke({ schemaVersion: 2, envelopeId: 'x' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    if (result.error.code !== 'validation') return;
    expect(result.error.issues[0]!.path).toBe('schemaVersion');
  });

  it('rejects an unknown host function (outside the closed vocabulary)', () => {
    const { session } = buildSession(GRANTS_READ_ONLY);
    const result = session.invoke(envelope({ hostFunction: 'network.fetch' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    if (result.error.code !== 'validation') return;
    expect(result.error.issues[0]!.path).toBe('hostFunction');
  });

  it('rejects a payload that violates the request contract with precise paths', () => {
    const { session } = buildSession(GRANTS_READ_ONLY);
    const result = session.invoke(envelope({ payload: { level: 'verbose', message: 'x' } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    if (result.error.code !== 'validation') return;
    expect(result.error.issues[0]!.path).toBe('payload.level');
    expect(result.error.message).toContain('request contract');
  });

  it('rejects an envelope with vendor fields (strict envelope objects)', () => {
    const { session } = buildSession(GRANTS_READ_ONLY);
    const result = session.invoke({ ...envelope(), apiKey: 'sk-live' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    if (result.error.code !== 'validation') return;
    expect(result.error.issues[0]!.message).toContain('Unrecognized key');
  });

  it('denied calls are audited with their typed denial code', () => {
    const { session } = buildSession(GRANTS_READ_ONLY);
    session.invoke(envelope({ hostFunction: 'storage.read', payload: { key: 'cache.x' } }));
    expect(session.auditTrail()).toEqual([
      {
        sequence: 1,
        envelopeId: 'inv-0001',
        capabilityId: 'engineering.stress-analysis',
        hostFunction: 'storage.read',
        decision: 'denied',
        denialCode: 'permission-denied',
      },
    ]);
  });
});
