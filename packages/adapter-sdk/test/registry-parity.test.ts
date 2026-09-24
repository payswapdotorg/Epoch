// Cross-package parity with @epoch/capability-registry (devDependency —
// NO runtime coupling): the two semver implementations produce identical
// results over a shared corpus, and real registry records flow through
// SDK negotiation end-to-end (register -> resolve -> negotiate -> pin).
import { describe, expect, it } from 'vitest';
import {
  CapabilityRegistry,
  compareSemver as registryCompare,
  parseSemverCore as registryParse,
  satisfiesVersionConstraint as registrySatisfies,
  sealCapabilityManifest,
} from '@epoch/capability-registry';
import {
  compareSemver as sdkCompare,
  negotiateBestBinding,
  negotiateBinding,
  parseSemverCore as sdkParse,
  satisfiesVersionConstraint as sdkSatisfies,
} from '../src/index';
import type { AdapterDescriptor } from '../src/index';
import { descriptor } from './helpers';

const CORPUS = [
  '0.0.0',
  '0.0.1',
  '0.1.0',
  '0.2.3',
  '0.10.0',
  '1.0.0',
  '1.0.1',
  '1.2.3',
  '1.9.9',
  '1.10.0',
  '2.0.0',
  '10.20.30',
];

const MALFORMED = ['', '1', '1.2', '1.2.3.4', 'v1.2.3', '1.2.3-beta', 'a.b.c', '1..3'];

const CONSTRAINTS = [
  { kind: 'exact', version: '1.0.0' },
  { kind: 'exact', version: '0.2.3' },
  { kind: 'exact', version: '9.9.9' },
  { kind: 'caret', version: '0.0.1' },
  { kind: 'caret', version: '0.2.3' },
  { kind: 'caret', version: '1.0.0' },
  { kind: 'caret', version: '1.2.3' },
  { kind: 'caret', version: '2.0.0' },
] as const;

describe('semver cross-parity (adapter-sdk vs capability-registry)', () => {
  it('both parsers agree on the shared corpus (accepts and rejects)', () => {
    for (const version of CORPUS) {
      expect(sdkParse(version).ok, version).toBe(registryParse(version).ok);
      expect(sdkParse(version)).toEqual(registryParse(version));
    }
    for (const version of MALFORMED) {
      expect(sdkParse(version).ok, version).toBe(false);
      expect(registryParse(version).ok, version).toBe(false);
    }
  });

  it('both orders agree on every corpus pair', () => {
    for (const a of CORPUS) {
      for (const b of CORPUS) {
        expect(Math.sign(sdkCompare(a, b)), `${a} vs ${b}`).toBe(
          Math.sign(registryCompare(a, b)),
        );
      }
    }
  });

  it('both constraint implementations agree on every (candidate, constraint) pair', () => {
    for (const candidate of [...CORPUS, ...MALFORMED]) {
      for (const constraint of CONSTRAINTS) {
        expect(
          sdkSatisfies(candidate, constraint),
          `${candidate} ~ ${constraint.kind}:${constraint.version}`,
        ).toBe(registrySatisfies(candidate, constraint));
      }
    }
  });
});

describe('registry -> SDK integration (structural consumption)', () => {
  function manifestAt(version: string): Record<string, unknown> {
    return {
      schemaVersion: 1,
      capabilityId: 'engineering.stress-analysis',
      category: 'simulation',
      version,
      descriptor: { displayName: 'Stress Analysis', inputs: [], outputs: [], assumptions: [] },
      contracts: [{ contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' }],
      trust: { origin: 'first-party' },
    };
  }

  it('a real registry record negotiates a binding pin through the SDK', () => {
    const registry = new CapabilityRegistry();
    for (const version of ['1.0.0', '1.2.3', '2.0.0']) {
      const sealed = sealCapabilityManifest(manifestAt(version));
      if (!sealed.ok) throw new Error(`fixture registration failed: ${version}`);
      const registered = registry.register(sealed.value);
      if (!registered.ok) throw new Error(`fixture registration failed: ${version}`);
    }
    const resolved = registry.resolve({
      capabilityId: 'engineering.stress-analysis',
      constraint: { kind: 'caret', version: '1.0.0' },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    // The registry record flows STRAIGHT into SDK negotiation (structural
    // assignability — no adapter, no runtime dependency).
    const desc = descriptor() as unknown as AdapterDescriptor;
    const negotiated = negotiateBinding(desc, resolved.value);
    expect(negotiated.ok).toBe(true);
    if (!negotiated.ok) return;
    expect(negotiated.value.capabilityVersion).toBe('1.2.3');
    expect(negotiated.value.manifestDigest).toBe(resolved.value.manifestDigest);
    expect(negotiated.value.adapterId).toBe('adapter:stress-solver');
  });

  it('negotiateBestBinding consumes registry list() output and matches registry resolution', () => {
    const registry = new CapabilityRegistry();
    for (const version of ['1.0.0', '1.2.3', '1.9.0', '2.0.0']) {
      const sealed = sealCapabilityManifest(manifestAt(version));
      if (!sealed.ok) throw new Error('fixture registration failed');
      if (!registry.register(sealed.value).ok) throw new Error('fixture registration failed');
    }
    const desc = descriptor() as unknown as AdapterDescriptor;
    const best = negotiateBestBinding(desc, registry.list());
    expect(best.ok).toBe(true);
    if (!best.ok) return;
    expect(best.value.capabilityVersion).toBe('1.9.0');
  });

  it('a retired registry record is rejected by SDK negotiation (lifecycle boundary holds across packages)', () => {
    const registry = new CapabilityRegistry();
    const sealed = sealCapabilityManifest(manifestAt('1.2.3'));
    if (!sealed.ok) throw new Error('fixture registration failed');
    if (!registry.register(sealed.value).ok) throw new Error('fixture registration failed');
    const retired = registry.retire({
      capabilityId: 'engineering.stress-analysis',
      version: '1.2.3',
    });
    expect(retired.ok).toBe(true);
    if (!retired.ok) return;

    const desc = descriptor() as unknown as AdapterDescriptor;
    const negotiated = negotiateBinding(desc, retired.value);
    expect(negotiated.ok).toBe(false);
    if (negotiated.ok) return;
    expect(negotiated.error.code).toBe('lifecycle-conflict');
  });
});
