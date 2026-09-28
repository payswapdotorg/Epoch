// W007 REGISTRATION PARITY (the REAL registry, devDependency): the
// derived capability registration admits verbatim into the REAL
// CapabilityRegistry, its digest equals the registry's own
// computeCapabilityManifestDigest, and the REAL SDK negotiateBinding
// binds the adapter descriptor to the record (the W029 registration
// precedent).
import { describe, expect, it } from 'vitest';
import { CapabilityRegistry, computeCapabilityManifestDigest } from '@epoch/capability-registry';
import { negotiateBinding, computeAdapterDescriptorDigest } from '@epoch/adapter-sdk';
import {
  CHAT_PROVIDER_ADAPTER_DESCRIPTOR,
  CHAT_PROVIDER_ADAPTER_DESCRIPTOR_DIGEST,
  ChatReferenceProvider,
  deriveCapabilityRegistrations,
} from '../src/index';

describe('W007 registration parity (the REAL registry)', () => {
  it('the derived digest equals the registry\'s own manifest digest', () => {
    for (const registration of deriveCapabilityRegistrations()) {
      expect(registration.digest).toBe(computeCapabilityManifestDigest(registration.manifest));
    }
  });

  it('the REAL registry admits the derived registration verbatim', () => {
    const registry = new CapabilityRegistry();
    for (const registration of deriveCapabilityRegistrations()) {
      const stored = registry.register(registration);
      expect(stored.ok).toBe(true);
    }
    expect(registry.size).toBe(1);
  });

  it('the REAL SDK negotiateBinding binds the descriptor to the registered record', () => {
    const registry = new CapabilityRegistry();
    const [registration] = deriveCapabilityRegistrations();
    if (registration === undefined) throw new Error('the derivation must produce a registration');
    const stored = registry.register(registration);
    if (!stored.ok) throw new Error(stored.error.message);
    const pin = negotiateBinding(CHAT_PROVIDER_ADAPTER_DESCRIPTOR, stored.value);
    expect(pin.ok).toBe(true);
    if (pin.ok) {
      expect(pin.value.adapterId).toBe(CHAT_PROVIDER_ADAPTER_DESCRIPTOR.adapterId);
      expect(pin.value.capabilityId).toBe('external.event-exchange');
      expect(pin.value.manifestDigest).toBe(registration.digest);
      expect(pin.value.adapterDescriptorDigest).toBe(CHAT_PROVIDER_ADAPTER_DESCRIPTOR_DIGEST);
    }
  });

  it('the descriptor digest equals the REAL SDK discipline over the descriptor', () => {
    expect(CHAT_PROVIDER_ADAPTER_DESCRIPTOR_DIGEST).toBe(
      computeAdapterDescriptorDigest(CHAT_PROVIDER_ADAPTER_DESCRIPTOR),
    );
  });

  it('the provider port carries the REAL descriptor + binding (the bridge sees W007 shapes)', () => {
    const provider = new ChatReferenceProvider();
    expect(provider.descriptor).toEqual(CHAT_PROVIDER_ADAPTER_DESCRIPTOR);
    expect(provider.capabilityBinding.capabilityId).toBe('external.event-exchange');
    expect(provider.capabilityBinding.versionRange).toEqual({
      kind: 'exact',
      version: '1.0.0',
    });
    expect(provider.supportedOutboundClasses).toContain('information');
    expect(provider.supportedInboundClasses).toContain('observation-report');
  });
});
