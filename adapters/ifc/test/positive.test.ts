// Positive evidence (acceptance: deterministic ingestion + typed semantic
// projections into the world-model graph).
import { describe, expect, it } from 'vitest';
import {
  IfcAdapterHost,
  modelDigestOf,
  parseProviderModel,
  projectModel,
  referenceModel,
  verifyObservation,
  verifyProjection,
  observeModel,
} from '../src/index';
import { REFERENCE_MODEL_ID, TENANT_A, T0, T1 } from './helpers';

describe('building-model ingestion (positive)', () => {
  it('ingests a provider model and returns a sealed, content-addressed ingestion record', () => {
    const host = new IfcAdapterHost();
    const ingested = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    expect(ingested.ok).toBe(true);
    if (!ingested.ok) throw new Error(ingested.error.message);
    expect(ingested.value.tenantId).toBe(TENANT_A);
    expect(ingested.value.modelId).toBe(REFERENCE_MODEL_ID);
    expect(ingested.value.disposition).toBe('ingested');
    expect(ingested.value.elementCount).toBe(8);
    expect(ingested.value.relationCount).toBe(4);
    expect(ingested.value.modelDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(ingested.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ingest is idempotent: a duplicate ingestion returns the sealed prior record', () => {
    const host = new IfcAdapterHost();
    const first = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    const second = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T1 });
    if (!first.ok || !second.ok) throw new Error('ingestion failed');
    expect(second.value.disposition).toBe('duplicate');
    expect(second.value.contentDigest).toBe(first.value.contentDigest);
    const listed = host.listIngestions(TENANT_A);
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value.length).toBe(1);
  });
});

describe('building-model semantic projection (positive)', () => {
  it('projects elements and relationships into REAL W002 assertion inputs', () => {
    const parsed = parseProviderModel(referenceModel());
    if (!parsed.success) throw new Error('fixture parse failed');
    const projection = projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    // Entities first (8 elements), then relations (7 edges: 2 aggregates + 5 containments).
    expect(projection.assertionInputs.length).toBe(15);
    const entities = projection.assertionInputs.filter((input) => input.statement.kind === 'entity');
    const relations = projection.assertionInputs.filter((input) => input.statement.kind === 'relation');
    expect(entities.length).toBe(8);
    expect(relations.length).toBe(7);
    for (const input of projection.assertionInputs) {
      expect(input.provenance.actor.id).toBe('adapter:building-model-semantic');
      expect(input.provenance.actor.role).toBe('external-provider');
      expect(input.provenance.method).toBe('building-model-projection');
      expect(input.provenance.evidence[0]?.kind).toBe('external');
      expect(input.provenance.evidence[0]?.digest).toBe(projection.source.digest);
      expect(input.confidence.method).toBe('imported');
      expect(input.confidence.distribution).toEqual({ kind: 'point', value: 1 });
      expect(input.validity?.from).toBe(T0);
    }
  });

  it('entity types are neutral construction type keys; the standard class rides as DATA', () => {
    const parsed = parseProviderModel(referenceModel());
    if (!parsed.success) throw new Error('fixture parse failed');
    const projection = projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    const wall = projection.assertionInputs.find(
      (input) => input.statement.kind === 'entity' && input.statement.properties?.providerElementClass === 'IfcWall',
    );
    expect(wall).toBeDefined();
    if (wall?.statement.kind !== 'entity') throw new Error('unreachable');
    expect(wall.statement.entityType).toBe('construction:wall');
    expect(wall.statement.properties?.displayName).toBe('Exterior Wall North');
    expect(wall.statement.properties?.thickness).toBe(300);
  });

  it('containment relationships map to neutral construction relations (elements -> containers)', () => {
    const parsed = parseProviderModel(referenceModel());
    if (!parsed.success) throw new Error('fixture parse failed');
    const projection = projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    const contained = projection.assertionInputs.filter(
      (input) => input.statement.kind === 'relation' && input.statement.relationType === 'construction:contained-in',
    );
    expect(contained.length).toBe(5); // 4 physical elements + 1 space in the storey.
    const aggregates = projection.assertionInputs.filter(
      (input) => input.statement.kind === 'relation' && input.statement.relationType === 'construction:aggregates',
    );
    expect(aggregates.length).toBe(2); // site -> building, building -> storey.
  });

  it('the source reference addresses the exact model revision (W006 conventions)', () => {
    const parsed = parseProviderModel(referenceModel());
    if (!parsed.success) throw new Error('fixture parse failed');
    const projection = projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    expect(projection.source.artifactId).toBe(REFERENCE_MODEL_ID);
    expect(projection.source.digest).toBe(modelDigestOf(parsed.data));
    expect(projection.source.revision).toMatch(/^content-[0-9a-f]{12}$/);
  });

  it('the observation record is content-addressed and verifiable', () => {
    const parsed = parseProviderModel(referenceModel());
    if (!parsed.success) throw new Error('fixture parse failed');
    const observation = observeModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
    expect(observation.provenance.actor.id).toBe('adapter:building-model-source');
    expect(observation.elementCount).toBe(8);
    expect(verifyObservation(observation)).toBe(true);
    expect(verifyProjection(projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 }))).toBe(true);
  });
});
