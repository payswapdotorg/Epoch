// Negative tests: every broken-registration/resolution class the
// registry must reject — duplicates, unknown pins, unsatisfied
// constraints, retirement blocking new bindings, illegal lifecycle
// transitions, and tampered digests at the register() door.
import { describe, expect, it } from 'vitest';
import type { RegistryError, RegistryResult } from '../src/index';
import { CapabilityRegistry } from '../src/index';
import { manifest, sealedWithForeignDigest, seal } from './helpers';

const ID = 'engineering.stress-analysis';

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: RegistryResult<T>): RegistryError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

describe('duplicate registration (negative)', () => {
  it('rejects registering the same (capabilityId, version) twice — different content', () => {
    const registry = new CapabilityRegistry();
    expect(registry.register(seal(manifest({ version: '1.0.0' }))).ok).toBe(true);
    const error = failureOf(
      registry.register(
        seal(
          manifest({
            version: '1.0.0',
            descriptor: { displayName: 'Changed', inputs: [], outputs: [], assumptions: [] },
          }),
        ),
      ),
    );
    expect(error.code).toBe('duplicate-capability');
    if (error.code !== 'duplicate-capability') return;
    expect(error.path).toEqual(['manifest', 'version']);
  });

  it('rejects registering the same (capabilityId, version) twice — identical content', () => {
    const registry = new CapabilityRegistry();
    expect(registry.register(seal(manifest({ version: '1.0.0' }))).ok).toBe(true);
    const error = failureOf(registry.register(seal(manifest({ version: '1.0.0' }))));
    expect(error.code).toBe('duplicate-capability');
  });

  it('the duplicate check keys on (id, version), not id alone', () => {
    const registry = new CapabilityRegistry();
    expect(registry.register(seal(manifest({ version: '1.0.0' }))).ok).toBe(true);
    expect(registry.register(seal(manifest({ version: '1.1.0' }))).ok).toBe(true);
    expect(registry.size).toBe(2);
  });
});

describe('unknown capability (negative)', () => {
  it('get rejects an unknown (id, version) pin', () => {
    const registry = new CapabilityRegistry();
    const error = failureOf(registry.get({ capabilityId: ID, version: '1.0.0' }));
    expect(error.code).toBe('unknown-capability');
  });

  it('resolve rejects an unknown capability id', () => {
    const registry = new CapabilityRegistry();
    const error = failureOf(
      registry.resolve({ capabilityId: ID, constraint: { kind: 'exact', version: '1.0.0' } }),
    );
    expect(error.code).toBe('unknown-capability');
  });

  it('deprecate/retire/deregister reject unknown pins', () => {
    const registry = new CapabilityRegistry();
    for (const result of [
      registry.deprecate({ capabilityId: ID, version: '1.0.0' }),
      registry.retire({ capabilityId: ID, version: '1.0.0' }),
      registry.deregister({ capabilityId: ID, version: '1.0.0' }),
    ]) {
      expect(failureOf(result).code).toBe('unknown-capability');
    }
  });

  it('get rejects a known id at an unknown version', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    const error = failureOf(registry.get({ capabilityId: ID, version: '2.0.0' }));
    expect(error.code).toBe('unknown-capability');
  });
});

describe('version-unsatisfied (negative)', () => {
  it('rejects when records exist but none satisfies the constraint', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '2.0.0' })));
    registry.register(seal(manifest({ version: '2.1.0' })));
    const error = failureOf(
      registry.resolve({ capabilityId: ID, constraint: { kind: 'caret', version: '1.0.0' } }),
    );
    expect(error.code).toBe('version-unsatisfied');
    if (error.code !== 'version-unsatisfied') return;
    expect(error.constraint).toEqual({ kind: 'caret', version: '1.0.0' });
    expect(error.availableVersions).toEqual(['2.0.0', '2.1.0']);
  });

  it('rejects an exact pin at a version that is not registered', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    const error = failureOf(
      registry.resolve({ capabilityId: ID, constraint: { kind: 'exact', version: '1.0.1' } }),
    );
    expect(error.code).toBe('version-unsatisfied');
  });
});

describe('retirement blocks new bindings (negative — lifecycle boundary)', () => {
  it('resolve rejects a retired record with lifecycle-conflict when retirement is the only obstacle', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    registry.retire({ capabilityId: ID, version: '1.0.0' });
    const error = failureOf(
      registry.resolve({ capabilityId: ID, constraint: { kind: 'exact', version: '1.0.0' } }),
    );
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('resolve falls back to a lower non-retired version instead of the retired best match', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    registry.register(seal(manifest({ version: '1.5.0' })));
    registry.retire({ capabilityId: ID, version: '1.5.0' });
    const result = registry.resolve({
      capabilityId: ID,
      constraint: { kind: 'caret', version: '1.0.0' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.manifest.version).toBe('1.0.0');
  });

  it('get still retrieves a retired record (inspection is not a new binding)', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    registry.retire({ capabilityId: ID, version: '1.0.0' });
    const result = registry.get({ capabilityId: ID, version: '1.0.0' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lifecycle).toBe('retired');
  });
});

describe('illegal lifecycle transitions (negative)', () => {
  it('rejects deprecating a retired record', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    registry.retire({ capabilityId: ID, version: '1.0.0' });
    const error = failureOf(registry.deprecate({ capabilityId: ID, version: '1.0.0' }));
    expect(error.code).toBe('lifecycle-conflict');
    if (error.code !== 'lifecycle-conflict') return;
    expect(error.from).toBe('retired');
    expect(error.to).toBe('deprecated');
  });

  it('rejects retiring a retired record (terminal state)', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    registry.retire({ capabilityId: ID, version: '1.0.0' });
    const error = failureOf(registry.retire({ capabilityId: ID, version: '1.0.0' }));
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('rejects deprecating an already-deprecated record', () => {
    const registry = new CapabilityRegistry();
    registry.register(seal(manifest({ version: '1.0.0' })));
    registry.deprecate({ capabilityId: ID, version: '1.0.0' });
    const error = failureOf(registry.deprecate({ capabilityId: ID, version: '1.0.0' }));
    expect(error.code).toBe('lifecycle-conflict');
    if (error.code !== 'lifecycle-conflict') return;
    expect(error.from).toBe('deprecated');
    expect(error.to).toBe('deprecated');
  });
});

describe('tampered registration digest (negative — integrity boundary)', () => {
  it('register rejects a manifest whose claimed digest does not match its content', () => {
    const registry = new CapabilityRegistry();
    const tampered = sealedWithForeignDigest(manifest({ version: '1.0.0' }));
    const error = failureOf(registry.register(tampered));
    expect(error.code).toBe('digest-mismatch');
    if (error.code !== 'digest-mismatch') return;
    expect(error.path).toEqual(['digest']);
    expect(error.expected).not.toBe(error.encountered);
  });

  it('a tampered registration never enters the registry', () => {
    const registry = new CapabilityRegistry();
    registry.register(sealedWithForeignDigest(manifest({ version: '1.0.0' })));
    expect(registry.size).toBe(0);
    expect(registry.list()).toHaveLength(0);
  });

  it('register rejects an invalid manifest before digest checks (typed validation issues)', () => {
    const registry = new CapabilityRegistry();
    // Validation precedes digest verification, so the digest value is
    // irrelevant here — it never gets checked.
    const bogus = {
      manifest: manifest({ version: '1.0.0', category: 'not-a-category' }),
      digest: 'a'.repeat(64),
    };
    const error = failureOf(registry.register(bogus as never));
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path === 'category')).toBe(true);
  });
});
