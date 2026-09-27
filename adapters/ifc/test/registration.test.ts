// W007 registration + binding + invocation evidence (acceptance: the
// adapter registers through the W007 conventions under its categories).
import { describe, expect, it } from 'vitest';
import { computeCapabilityManifestDigest, sealCapabilityManifest } from '@epoch/capability-registry';
import { negotiateBinding } from '@epoch/adapter-sdk';
import {
  IFC_ADAPTER_DESCRIPTORS,
  SEMANTIC_ADAPTER_DESCRIPTOR,
  SOURCE_ADAPTER_DESCRIPTOR,
  deriveCapabilityRegistrations,
  referenceModel,
} from '../src/index';
import { REFERENCE_MODEL_ID, TENANT_A, T0, adapterSetup, registryWithAdapter } from './helpers';

describe('W007 registration (the REAL registry, devDependency parity)', () => {
  it('derives both category registrations (source + semantic) with correct categories', () => {
    const registrations = deriveCapabilityRegistrations();
    expect(registrations.map((registration) => registration.manifest.category).sort()).toEqual([
      'semantic',
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
    expect(records.filter((record) => record.manifest.category === 'semantic').length).toBe(1);
    for (const record of records) {
      expect(record.manifest.trust.origin).toBe('external-software');
      expect(record.lifecycle).toBe('registered');
    }
  });

  it('the REAL SDK negotiates the binding for both adapter descriptors', () => {
    const registry = registryWithAdapter();
    for (const descriptor of IFC_ADAPTER_DESCRIPTORS) {
      const record = registry
        .list({ category: descriptor.category })
        .find((entry) => entry.manifest.capabilityId === descriptor.binding.capabilityId);
      expect(record).toBeDefined();
      const negotiated = negotiateBinding(descriptor, record!);
      expect(negotiated.ok).toBe(true);
      if (negotiated.ok) {
        expect(negotiated.value.adapterId).toBe(descriptor.adapterId);
        expect(negotiated.value.capabilityId).toBe(descriptor.binding.capabilityId);
        expect(negotiated.value.manifestDigest).toBe(record!.manifestDigest);
      }
    }
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
  it('a source invocation through a REAL negotiated pin returns the observation', async () => {
    const { source, host } = adapterSetup();
    const ingested = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    if (!ingested.ok) throw new Error(ingested.error.message);
    const registry = registryWithAdapter();
    const record = registry.list({ category: 'source' })[0]!;
    const negotiated = negotiateBinding(source.descriptor, record);
    if (!negotiated.ok) throw new Error(negotiated.error.message);
    const response = await source.invoke({
      schemaVersion: 1,
      category: 'source',
      binding: negotiated.value,
      payload: { inputs: { tenant: TENANT_A, model: REFERENCE_MODEL_ID } },
    });
    expect(response.category).toBe('source');
    expect(response.binding.manifestDigest).toBe(record.manifestDigest);
    expect(response.payload.outputs['observation-digest']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a semantic invocation through a REAL negotiated pin returns the projection', async () => {
    const { semantic, host } = adapterSetup();
    const ingested = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    if (!ingested.ok) throw new Error(ingested.error.message);
    const registry = registryWithAdapter();
    const record = registry.list({ category: 'semantic' })[0]!;
    const negotiated = negotiateBinding(semantic.descriptor, record);
    if (!negotiated.ok) throw new Error(negotiated.error.message);
    const response = await semantic.invoke({
      schemaVersion: 1,
      category: 'semantic',
      binding: negotiated.value,
      payload: { inputs: { tenant: TENANT_A, model: REFERENCE_MODEL_ID } },
    });
    expect(response.category).toBe('semantic');
    expect(response.payload.outputs['projection-digest']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('both surfaces share the same underlying sealed model (source == semantic scope)', async () => {
    const { source, semantic, host } = adapterSetup();
    const ingested = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    if (!ingested.ok) throw new Error(ingested.error.message);
    const registry = registryWithAdapter();
    const sourcePin = negotiateBinding(
      source.descriptor,
      registry.list({ category: 'source' })[0]!,
    );
    const semanticPin = negotiateBinding(
      semantic.descriptor,
      registry.list({ category: 'semantic' })[0]!,
    );
    if (!sourcePin.ok || !semanticPin.ok) throw new Error('negotiation failed');
    const observation = await source.invoke({
      schemaVersion: 1,
      category: 'source',
      binding: sourcePin.value,
      payload: { inputs: { tenant: TENANT_A, model: REFERENCE_MODEL_ID } },
    });
    const projection = await semantic.invoke({
      schemaVersion: 1,
      category: 'semantic',
      binding: semanticPin.value,
      payload: { inputs: { tenant: TENANT_A, model: REFERENCE_MODEL_ID } },
    });
    // Both address the SAME exact model revision.
    const observationRecord = observation.payload.outputs.observation as { source: { digest: string } };
    const projectionRecord = projection.payload.outputs.projection as { source: { digest: string } };
    expect(observationRecord.source.digest).toBe(projectionRecord.source.digest);
    void SEMANTIC_ADAPTER_DESCRIPTOR;
  });
});
