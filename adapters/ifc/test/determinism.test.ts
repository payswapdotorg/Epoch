// Determinism + replay evidence (acceptance: same fixture -> identical
// projection digest; idempotent ingestion).
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  IfcAdapterHost,
  modelDigestOf,
  observeModel,
  parseProviderModel,
  projectModel,
  referenceModel,
} from '../src/index';
import { REFERENCE_MODEL_ID, TENANT_A, T0, T1, adapterSetup, pinFor, registryWithAdapter } from './helpers';

describe('determinism', () => {
  it('the same fixture content always produces the same model digest (any parse)', () => {
    const first = parseProviderModel(referenceModel());
    const second = parseProviderModel(referenceModel());
    if (!first.success || !second.success) throw new Error('fixture parse failed');
    expect(modelDigestOf(first.data)).toBe(modelDigestOf(second.data));
  });

  it('the same (tenant, model, instant) projects to byte-identical projections', () => {
    const first = parseProviderModel(referenceModel());
    const second = parseProviderModel(referenceModel());
    if (!first.success || !second.success) throw new Error('fixture parse failed');
    const a = projectModel({ tenantId: TENANT_A, model: first.data, observedAt: T0 });
    const b = projectModel({ tenantId: TENANT_A, model: second.data, observedAt: T0 });
    expect(a.projectionDigest).toBe(b.projectionDigest);
    expect(a.assertionInputs).toEqual(b.assertionInputs);
  });

  it('provider row order never leaks into the projection order', () => {
    const parsed = parseProviderModel(referenceModel());
    if (!parsed.success) throw new Error('fixture parse failed');
    const reordered = {
      ...parsed.data,
      elements: [...parsed.data.elements].reverse(),
      relations: [...parsed.data.relations].reverse(),
    };
    const a = projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    const b = projectModel({ tenantId: TENANT_A, model: reordered, observedAt: T0 });
    // The model digests differ (row order is content), but the projection's
    // entity ordering is canonical and the statements are identical sets.
    const statements = (projection: typeof a) => projection.assertionInputs.map((input) => input.statement);
    expect(statements(a).slice(0, 8).map((s) => (s as { entityId: string }).entityId)).toEqual(
      statements(b).slice(0, 8).map((s) => (s as { entityId: string }).entityId).sort(),
    );
    const ids = statements(a).slice(0, 8).map((s) => (s as { entityId: string }).entityId);
    expect([...ids].sort()).toEqual(ids);
  });

  it('different instants change the projection (digests are content-sensitive)', () => {
    const parsed = parseProviderModel(referenceModel());
    if (!parsed.success) throw new Error('fixture parse failed');
    const a = projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    const b = projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T1 });
    expect(a.projectionDigest).not.toBe(b.projectionDigest);
  });

  it('the observation record is deterministic for identical inputs', () => {
    const parsed = parseProviderModel(referenceModel());
    if (!parsed.success) throw new Error('fixture parse failed');
    const a = observeModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    const b = observeModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    expect(a.contentDigest).toBe(b.contentDigest);
  });

  it('the W007 semantic envelope is deterministic across independent invocations', async () => {
    const setupA = adapterSetup();
    const setupB = adapterSetup();
    for (const setup of [setupA, setupB]) {
      const ingested = setup.host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
      if (!ingested.ok) throw new Error(ingested.error.message);
    }
    const registry = registryWithAdapter();
    const pinA = pinFor(setupA.semantic, registry);
    const pinB = pinFor(setupB.semantic, registry);
    const request = {
      schemaVersion: 1 as const,
      category: 'semantic' as const,
      binding: pinA,
      payload: { inputs: { tenant: TENANT_A, model: REFERENCE_MODEL_ID } },
    };
    const a = await setupA.semantic.invoke({ ...request, binding: pinA });
    const b = await setupB.semantic.invoke({ ...request, binding: pinB });
    expect(a.payload.outputs['projection-digest']).toBe(b.payload.outputs['projection-digest']);
  });

  it('replayed ingestion never mutates sealed state (snapshot equality)', () => {
    const host = new IfcAdapterHost();
    host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    const before = host.listIngestions(TENANT_A);
    if (!before.ok) throw new Error(before.error.message);
    const digestBefore = canonicalDigest([...before.value] as unknown as import('@epoch/agent-protocol').JsonValue);
    host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T1 });
    const after = host.listIngestions(TENANT_A);
    if (!after.ok) throw new Error(after.error.message);
    // The duplicate carries only the disposition marker; the sealed record is unchanged.
    const normalized = after.value.map((record) => ({ ...record, disposition: 'ingested' as const }));
    expect(canonicalDigest([...normalized] as unknown as import('@epoch/agent-protocol').JsonValue)).toBe(digestBefore);
  });
});
