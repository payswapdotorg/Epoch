// Negative evidence (acceptance: typed rejections for every failure class).
import { describe, expect, it } from 'vitest';
import {
  IfcAdapterHost,
  conflictingModel,
  danglingRelationModel,
  incompleteModel,
  malformedModel,
  parseProviderModel,
  projectModel,
  referenceModel,
  verifyProjection,
} from '../src/index';
import { REFERENCE_MODEL_ID, TENANT_A, TENANT_B, T0, adapterSetup, pinFor, registryWithAdapter } from './helpers';

describe('negative: tenant isolation (R12)', () => {
  it('ingestion naming another tenant is the typed tenant-isolation-rejected', () => {
    const host = new IfcAdapterHost({ expectedTenantId: TENANT_A });
    const result = host.ingestModel({ tenantId: TENANT_B, payload: referenceModel(), ingestedAt: T0 });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
    expect(result.error.expectedTenantId).toBe(TENANT_A);
    expect(result.error.encounteredTenantId).toBe(TENANT_B);
  });

  it('a cross-tenant projection through the W007 envelope is the typed tenant-isolation-rejected', () => {
    const { semantic } = adapterSetup();
    const pin = pinFor(semantic, registryWithAdapter());
    const result = semantic.invokeTotal({
      schemaVersion: 1,
      category: 'semantic',
      binding: pin,
      payload: { inputs: { tenant: TENANT_B, model: REFERENCE_MODEL_ID } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });

  it('a cross-tenant sealed-model read is the typed tenant-isolation-rejected', () => {
    const host = new IfcAdapterHost({ expectedTenantId: TENANT_A });
    const cross = host.sealedModel(TENANT_B, REFERENCE_MODEL_ID);
    expect(cross.ok).toBe(false);
    if (cross.ok || cross.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });
});

describe('negative: unknown provider payloads', () => {
  it('a malformed envelope is the typed unknown-provider-payload (never a partial load)', () => {
    const host = new IfcAdapterHost();
    const result = host.ingestModel({ tenantId: TENANT_A, payload: malformedModel(), ingestedAt: T0 });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'unknown-provider-payload') throw new Error('unexpected outcome');
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it('a relation referencing an absent element is the typed unknown-provider-payload', () => {
    const host = new IfcAdapterHost();
    const result = host.ingestModel({ tenantId: TENANT_A, payload: danglingRelationModel(), ingestedAt: T0 });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'unknown-provider-payload') throw new Error('unexpected outcome');
  });
});

describe('negative: ingestion admission (never a partial silent load)', () => {
  it('a model with no spatial root is the typed ingestion-rejected with a reason', () => {
    const host = new IfcAdapterHost();
    const result = host.ingestModel({ tenantId: TENANT_A, payload: incompleteModel(), ingestedAt: T0 });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'ingestion-rejected') throw new Error('unexpected outcome');
    expect(result.error.reason).toBe('no-spatial-root');
    // Nothing was admitted (no partial load).
    const listed = host.listIngestions(TENANT_A);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value.length).toBe(0);
  });
});

describe('negative: tamper detection', () => {
  it('a claimed digest that does not match the content is the typed digest-mismatch', () => {
    const host = new IfcAdapterHost();
    const result = host.ingestModel({
      tenantId: TENANT_A,
      payload: referenceModel(),
      claimedDigest: '0'.repeat(64),
      ingestedAt: T0,
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'digest-mismatch') throw new Error('unexpected outcome');
    expect(result.error.encountered).toBe('0'.repeat(64));
  });
});

describe('negative: replay conflicts', () => {
  it('different content under the same model key is the typed replay-conflict', () => {
    const host = new IfcAdapterHost();
    const first = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    expect(first.ok).toBe(true);
    const conflict = host.ingestModel({ tenantId: TENANT_A, payload: conflictingModel(), ingestedAt: T0 });
    expect(conflict.ok).toBe(false);
    if (conflict.ok || conflict.error.code !== 'replay-conflict') throw new Error('unexpected outcome');
    expect(conflict.error.expectedDigest).not.toBe(conflict.error.encounteredDigest);
  });
});

describe('negative: external semantics are never authority', () => {
  it('an authoritative-mode projection request is the typed external-semantics-not-authority', () => {
    const { semantic, host } = adapterSetup();
    const ingested = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    if (!ingested.ok) throw new Error(ingested.error.message);
    const pin = pinFor(semantic, registryWithAdapter());
    const result = semantic.invokeTotal({
      schemaVersion: 1,
      category: 'semantic',
      binding: pin,
      payload: { inputs: { tenant: TENANT_A, model: REFERENCE_MODEL_ID, mode: 'authoritative' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'external-semantics-not-authority') throw new Error('unexpected outcome');
    expect(result.error.attemptedMode).toBe('authoritative');
  });

  it('a direct-write-mode projection request is the typed external-semantics-not-authority', () => {
    const { semantic, host } = adapterSetup();
    const ingested = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    if (!ingested.ok) throw new Error(ingested.error.message);
    const pin = pinFor(semantic, registryWithAdapter());
    const result = semantic.invokeTotal({
      schemaVersion: 1,
      category: 'semantic',
      binding: pin,
      payload: { inputs: { tenant: TENANT_A, model: REFERENCE_MODEL_ID, mode: 'direct-write' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'external-semantics-not-authority') throw new Error('unexpected outcome');
    expect(result.error.attemptedMode).toBe('direct-write');
  });
});

describe('negative: binding conflicts', () => {
  it('an envelope bound to another adapter revision is the typed binding-conflict', () => {
    const { source } = adapterSetup();
    const pin = pinFor(source, registryWithAdapter());
    const distorted = source.invokeTotal({
      schemaVersion: 1,
      category: 'source',
      binding: { ...pin, adapterDescriptorDigest: 'f'.repeat(64) },
      payload: { inputs: { tenant: TENANT_A, model: REFERENCE_MODEL_ID } },
    });
    expect(distorted.ok).toBe(false);
    if (distorted.ok || distorted.error.code !== 'binding-conflict') throw new Error('unexpected outcome');
    expect(distorted.error.encountered).toContain('f'.repeat(64));
  });

  it('an envelope targeting the wrong category is the typed binding-conflict', () => {
    const { source } = adapterSetup();
    const pin = pinFor(source, registryWithAdapter());
    const result = source.invokeTotal({
      schemaVersion: 1,
      category: 'semantic' as 'source',
      binding: pin,
      payload: { inputs: { tenant: TENANT_A, model: REFERENCE_MODEL_ID } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'binding-conflict') throw new Error('unexpected outcome');
  });
});

describe('negative: envelope validation', () => {
  it('malformed neutral inputs are the typed validation error with precise paths', () => {
    const { semantic } = adapterSetup();
    const pin = pinFor(semantic, registryWithAdapter());
    const result = semantic.invokeTotal({
      schemaVersion: 1,
      category: 'semantic',
      binding: pin,
      payload: { inputs: { tenant: TENANT_A, model: 'not-a-model-id' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'validation') throw new Error('unexpected outcome');
  });

  it('a missing sealed model is the typed validation error (no silent empty projection)', () => {
    const { semantic } = adapterSetup();
    const pin = pinFor(semantic, registryWithAdapter());
    const result = semantic.invokeTotal({
      schemaVersion: 1,
      category: 'semantic',
      binding: pin,
      payload: { inputs: { tenant: TENANT_A, model: 'bim:never-ingested' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'validation') throw new Error('unexpected outcome');
    expect(result.error.issues[0]?.path).toBe('$.model');
  });

  it('a tampered projection is detected by digest verification', () => {
    const parsed = parseProviderModel(referenceModel());
    if (!parsed.success) throw new Error('fixture parse failed');
    const projection = projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    const tampered = {
      ...projection,
      assertionInputs: projection.assertionInputs.map((input, index) =>
        index === 0 ? { ...input, statement: { ...input.statement, entityId: 'entity:tampered' } } : input,
      ),
    };
    expect(verifyProjection(tampered)).toBe(false);
    expect(verifyProjection(projection)).toBe(true);
  });
});
