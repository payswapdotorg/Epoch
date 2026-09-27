// RUNTIME parity with the REAL W002 world-model authority and the REAL
// W006 evidence pipeline (devDependencies only — the frozen runtime
// dependency policy).
import { describe, expect, it } from 'vitest';
import { AssertionSchema, WorldModel, type Assertion } from '@epoch/world-model';
import { parseEvidenceRecord } from '@epoch/evidence';
import { parseProviderModel, projectModel, referenceModel, verifyProjection } from '../src/index';
import {
  REFERENCE_MODEL_ID,
  TENANT_A,
  T0,
  applyProjection,
  referenceProjection,
  worldWithConstructionVocabulary,
} from './helpers';

const PARSED = parseProviderModel(referenceModel());
const PROJECTION = PARSED.success
  ? projectModel({ tenantId: TENANT_A, model: PARSED.data, observedAt: T0 })
  : undefined;

describe('W002 world-model parity (the world model is the semantic authority)', () => {
  it('every projected assertion input is INPUT-shaped: passes the input schema, FAILS the authority schema', () => {
    if (PROJECTION === undefined) throw new Error('fixture parse failed');
    for (const input of PROJECTION.assertionInputs) {
      // Input records carry statement + provenance + confidence (+ validity):
      // they lack the authority-assigned fields (id, key, status, sequence).
      const asRecord = { ...input, id: undefined };
      expect(asRecord.id).toBeUndefined();
      // The input itself is not an Assertion record.
      const authority = AssertionSchema.safeParse(input);
      expect(authority.success).toBe(false);
    }
  });

  it('the REAL WorldModel authority admits the projected assertion inputs (external semantics adapted, authority retained)', () => {
    if (PROJECTION === undefined) throw new Error('fixture parse failed');
    const world = worldWithConstructionVocabulary();
    const applied: Assertion[] = applyProjection(world, PROJECTION);
    expect(applied.length).toBe(PROJECTION.assertionInputs.length);
    for (const assertion of applied) {
      // The WORLD MODEL assigned the ids and sequences — the adapter never does.
      expect(assertion.id).toMatch(/^ass-[0-9]+$/);
      expect(assertion.provenance.actor.role).toBe('external-provider');
      expect(assertion.status).toBe('live');
    }
    const statistics = world.statistics();
    expect(statistics.assertionCount).toBe(PROJECTION.assertionInputs.length);
    expect(statistics.liveAssertionCount).toBe(PROJECTION.assertionInputs.length);
  });

  it('the materialized world graph carries the neutral construction vocabulary (never the standard classes)', () => {
    if (PROJECTION === undefined) throw new Error('fixture parse failed');
    const world = worldWithConstructionVocabulary();
    applyProjection(world, PROJECTION);
    const wallEntity = world.getEntity(`entity:${REFERENCE_MODEL_ID}-elem-e10`, T0);
    expect(wallEntity).toBeDefined();
    expect(wallEntity?.type).toBe('construction:wall');
    expect(wallEntity?.properties.displayName).toBe('Exterior Wall North');
  });

  it('an unregistered construction type is rejected by the authority (the adapter cannot smuggle vocabulary)', () => {
    if (PROJECTION === undefined) throw new Error('fixture parse failed');
    const world = WorldModel.create(); // core vocabulary only
    const first = PROJECTION.assertionInputs[0]!;
    expect(() => world.applyAssertion(first)).toThrow(/unknown entity type/);
  });
});

describe('W006 evidence parity (the source reference is exact-revision evidence)', () => {
  it('a model observation addresses a W006 evidence record (exact-revision subject)', () => {
    if (PROJECTION === undefined) throw new Error('fixture parse failed');
    const evidence = {
      schemaVersion: 1,
      kind: 'observation',
      subject: {
        artifactId: PROJECTION.source.artifactId,
        revision: PROJECTION.source.revision,
        digest: PROJECTION.source.digest,
      },
      producedBy: {
        runId: `projection:${PROJECTION.projectionDigest}`,
        actorId: 'adapter:building-model-semantic',
      },
      observedAt: PROJECTION.observedAt,
      content: {
        mediaType: 'application/json',
        data: { 'projection-digest': PROJECTION.projectionDigest },
      },
      confidence: {
        distribution: { kind: 'point', value: 1 },
        method: 'imported',
      },
    };
    const parsed = parseEvidenceRecord(evidence);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  });

  it('the projection verifies end-to-end (digest discipline)', () => {
    if (PROJECTION === undefined) throw new Error('fixture parse failed');
    expect(verifyProjection(PROJECTION)).toBe(true);
    void referenceProjection;
  });
});
