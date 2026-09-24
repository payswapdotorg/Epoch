// Positive tests: bind-time negotiation — happy paths, best-match
// selection, advisory deprecation, and determinism.
import { describe, expect, it } from 'vitest';
import { negotiateBestBinding, negotiateBinding, parseAdapterDescriptor } from '../src/index';
import { capability, descriptor, expectedPin, typedDescriptor } from './helpers';

describe('negotiateBinding (positive)', () => {
  it('negotiates a binding pin carrying both content addresses', () => {
    const desc = typedDescriptor();
    const result = negotiateBinding(desc, capability());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(expectedPin(desc));
    expect(result.value.capabilityId).toBe('engineering.stress-analysis');
    expect(result.value.capabilityVersion).toBe('1.2.3');
    expect(result.value.manifestDigest).toBe(capability().manifestDigest);
    expect(result.value.adapterDescriptorDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a deprecated capability still binds (deprecation is advisory)', () => {
    const result = negotiateBinding(
      typedDescriptor(),
      capability({ lifecycle: 'deprecated' }),
    );
    expect(result.ok).toBe(true);
  });

  it('an exact range binds only the pinned version', () => {
    const desc = parseAdapterDescriptor(
      descriptor({ binding: { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'exact', version: '1.2.3' } } }),
    );
    if (!desc.ok) throw new Error('fixture descriptor is invalid');
    const result = negotiateBinding(desc.value, capability());
    expect(result.ok).toBe(true);
  });
});

describe('negotiateBestBinding (positive)', () => {
  it('picks the HIGHEST satisfying version deterministically', () => {
    const versions = ['1.0.0', '1.2.3', '1.9.0', '2.0.0'];
    const capabilities = versions.map((version) =>
      capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'simulation', version } }),
    );
    const result = negotiateBestBinding(typedDescriptor(), capabilities);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.capabilityVersion).toBe('1.9.0');
  });

  it('is independent of the input order', () => {
    const make = () => [
      capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'simulation', version: '1.2.3' } }),
      capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'simulation', version: '1.0.0' } }),
      capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'simulation', version: '1.9.0' } }),
    ];
    const forward = negotiateBestBinding(typedDescriptor(), make());
    const backward = negotiateBestBinding(typedDescriptor(), [...make()].reverse());
    expect(forward.ok && backward.ok).toBe(true);
    if (!forward.ok || !backward.ok) return;
    expect(forward.value).toEqual(backward.value);
  });

  it('skips retired records and binds the best non-retired version', () => {
    const capabilities = [
      capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'simulation', version: '1.2.3' }, lifecycle: 'retired' }),
      capability({ manifest: { capabilityId: 'engineering.stress-analysis', category: 'simulation', version: '1.0.0' } }),
    ];
    const result = negotiateBestBinding(typedDescriptor(), capabilities);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.capabilityVersion).toBe('1.0.0');
  });

  it('duplicate versions tie-break on manifest digest ascending (total order)', () => {
    const low = capability({ manifestDigest: '0'.repeat(64) });
    const high = capability({ manifestDigest: 'f'.repeat(64) });
    for (const order of [
      [low, high],
      [high, low],
    ]) {
      const result = negotiateBestBinding(typedDescriptor(), order);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.manifestDigest).toBe('0'.repeat(64));
    }
  });
});
