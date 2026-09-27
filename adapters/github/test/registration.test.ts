// W007 registration + binding + invocation evidence (acceptance: the
// adapter registers through the W007 conventions under its categories,
// and the registered binding drives a REAL envelope invocation).
import { describe, expect, it } from 'vitest';
import { computeCapabilityManifestDigest, sealCapabilityManifest } from '@epoch/capability-registry';
import { negotiateBinding } from '@epoch/adapter-sdk';
import {
  ACTION_ADAPTER_DESCRIPTOR,
  GITHUB_ADAPTER_DESCRIPTORS,
  SOURCE_ADAPTER_DESCRIPTOR,
  deriveCapabilityRegistrations,
} from '../src/index';
import { TENANT_A, T0, T1, adapterSetup, allowingContext, registryWithAdapter, PRINCIPAL } from './helpers';

describe('W007 registration (the REAL registry, devDependency parity)', () => {
  it('derives both category registrations (source + action) with correct categories', () => {
    const registrations = deriveCapabilityRegistrations();
    expect(registrations.map((registration) => registration.manifest.category).sort()).toEqual([
      'action',
      'source',
    ]);
  });

  it('the derived digest equals the REAL registry manifest digest', () => {
    for (const registration of deriveCapabilityRegistrations()) {
      expect(registration.digest).toBe(computeCapabilityManifestDigest(registration.manifest));
    }
  });

  it('the REAL registry admits every derived registration under its category', () => {
    const registry = registryWithAdapter();
    const records = registry.list();
    expect(records.length).toBe(2);
    expect(records.filter((record) => record.manifest.category === 'source').length).toBe(1);
    expect(records.filter((record) => record.manifest.category === 'action').length).toBe(1);
    for (const record of records) {
      expect(record.manifest.trust.origin).toBe('external-software');
      expect(record.lifecycle).toBe('registered');
    }
  });

  it('the REAL SDK negotiates the binding for both adapter descriptors', () => {
    const registry = registryWithAdapter();
    for (const descriptor of GITHUB_ADAPTER_DESCRIPTORS) {
      const record = registry
        .list({ category: descriptor.category })
        .find((entry) => entry.manifest.capabilityId === descriptor.binding.capabilityId);
      expect(record).toBeDefined();
      const negotiated = negotiateBinding(descriptor, record!);
      expect(negotiated.ok).toBe(true);
      if (negotiated.ok) {
        expect(negotiated.value.adapterId).toBe(descriptor.adapterId);
        expect(negotiated.value.capabilityId).toBe(descriptor.binding.capabilityId);
        expect(negotiated.value.capabilityVersion).toBe(descriptor.binding.versionRange.version);
        expect(negotiated.value.manifestDigest).toBe(record!.manifestDigest);
      }
    }
  });

  it('both descriptors carry the SDK digest discipline (content-addressed)', () => {
    const registry = registryWithAdapter();
    for (const descriptor of [SOURCE_ADAPTER_DESCRIPTOR, ACTION_ADAPTER_DESCRIPTOR]) {
      const record = registry
        .list({ category: descriptor.category })
        .find((entry) => entry.manifest.capabilityId === descriptor.binding.capabilityId);
      const negotiated = negotiateBinding(descriptor, record!);
      if (!negotiated.ok) throw new Error(negotiated.error.message);
      expect(negotiated.value.adapterDescriptorDigest).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(ACTION_ADAPTER_DESCRIPTOR.category).toBe('action');
  });

  it('retirement stops new bindings (the lifecycle convention holds through the real registry)', () => {
    const registry = registryWithAdapter();
    const record = registry.list({ category: 'source' })[0]!;
    registry.retire({ capabilityId: record.manifest.capabilityId, version: record.manifest.version });
    const retired = registry.get({
      capabilityId: record.manifest.capabilityId,
      version: record.manifest.version,
    });
    if (!retired.ok) throw new Error(retired.error.message);
    const negotiated = negotiateBinding(SOURCE_ADAPTER_DESCRIPTOR, retired.value);
    expect(negotiated.ok).toBe(false);
    if (negotiated.ok) throw new Error('unreachable');
    expect(negotiated.error.code).toBe('lifecycle-conflict');
  });

  it('an unknown manifest version is rejected by the sealing pipeline (registry conventions)', () => {
    const sealed = sealCapabilityManifest({ schemaVersion: 99 });
    expect(sealed.ok).toBe(false);
  });
});

describe('registered invocation (the envelope end-to-end)', () => {
  it('a source invocation through a REAL negotiated pin returns the projection', async () => {
    const { source, host } = adapterSetup();
    const ingested = host.ingestSnapshot({ tenantId: TENANT_A, payload: (await import('../src/index')).referenceSnapshot(), ingestedAt: T0 });
    if (!ingested.ok) throw new Error(ingested.error.message);
    const registry = registryWithAdapter();
    const record = registry.list({ category: 'source' })[0]!;
    const negotiated = negotiateBinding(source.descriptor, record);
    if (!negotiated.ok) throw new Error(negotiated.error.message);
    const response = await source.invoke({
      schemaVersion: 1,
      category: 'source',
      binding: negotiated.value,
      payload: { inputs: { tenant: TENANT_A, workspace: 'sw:epoch-reference-app' } },
    });
    expect(response.category).toBe('source');
    expect(response.binding.manifestDigest).toBe(record.manifestDigest);
    expect(typeof response.payload.outputs['projection-digest']).toBe('string');
    expect(response.payload.outputs['projection-digest']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('an action invocation through a REAL negotiated pin routes through the authority', async () => {
    const { action, host } = adapterSetup();
    const reference = (await import('../src/index')).referenceSnapshot();
    const ingested = host.ingestSnapshot({ tenantId: TENANT_A, payload: reference, ingestedAt: T0 });
    if (!ingested.ok) throw new Error(ingested.error.message);
    const registry = registryWithAdapter();
    const record = registry.list({ category: 'action' })[0]!;
    const negotiated = negotiateBinding(action.descriptor, record);
    if (!negotiated.ok) throw new Error(negotiated.error.message);
    const response = await action.invoke({
      schemaVersion: 1,
      category: 'action',
      binding: negotiated.value,
      payload: {
        target: { kind: 'external-resource', ref: 'sw:epoch-reference-app' },
        parameters: {
          tenant: TENANT_A,
          workspace: 'sw:epoch-reference-app',
          'change-kind': 'revision',
          summary: 'registered invocation',
          authority: { principalId: PRINCIPAL, context: allowingContext() },
          'decided-at': T1,
          approval: { deadline: '2026-03-05T10:00:00.000Z', maxDelegationDepth: 1 },
        },
      },
    });
    expect(response.category).toBe('action');
    // The change requires human approval: the authority is pending, not executed.
    expect(response.payload.status).toBe('failed');
    if (response.payload.status !== 'failed') throw new Error('unreachable');
    expect(response.payload.failure.code).toBe('precondition-not-met');
    expect(response.payload.failure.message).toContain('authority-pending-approval');
  });
});
