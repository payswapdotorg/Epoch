// Round-trip serialization + digest verification for every public type
// (acceptance: all public record shapes serialize deterministically,
// parse back to equal values, and address their exact content revision).
import { describe, expect, it } from 'vitest';
import { canonicalDigest, canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  BuildingModelObservationSchema,
  BuildingModelProjectionSchema,
  IfcAdapterHost,
  ModelIngestionRecordSchema,
  observeModel,
  parseProviderModel,
  projectModel,
  referenceModel,
  verifyObservation,
  verifyProjection,
} from '../src/index';
import { TENANT_A, T0 } from './helpers';

const PARSED = parseProviderModel(referenceModel());
const PROJECTION = PARSED.success
  ? projectModel({ tenantId: TENANT_A, model: PARSED.data, observedAt: T0 })
  : undefined;
const OBSERVATION = PARSED.success
  ? observeModel({ tenantId: TENANT_A, model: PARSED.data, observedAt: T0 })
  : undefined;

function roundTrip(value: unknown, parse: (input: unknown) => { success: boolean; data?: unknown }): void {
  const serialized = canonicalJsonStringify(value as JsonValue);
  const parsed = parse(JSON.parse(serialized));
  expect(parsed.success, `${serialized}`).toBe(true);
  const reserialized = canonicalJsonStringify((parsed as { data: unknown }).data as JsonValue);
  expect(reserialized).toBe(serialized);
}

describe('round-trip serialization + digest verification (every public type)', () => {
  it('ModelIngestionRecord round-trips through canonical JSON', () => {
    const host = new IfcAdapterHost();
    const ingested = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
    if (!ingested.ok) throw new Error(ingested.error.message);
    roundTrip(ingested.value, (input) => ModelIngestionRecordSchema.safeParse(input));
  });

  it('BuildingModelObservation round-trips through canonical JSON', () => {
    if (OBSERVATION === undefined) throw new Error('fixture parse failed');
    roundTrip(OBSERVATION, (input) => BuildingModelObservationSchema.safeParse(input));
  });

  it('BuildingModelProjection round-trips through canonical JSON', () => {
    if (PROJECTION === undefined) throw new Error('fixture parse failed');
    roundTrip(PROJECTION, (input) => BuildingModelProjectionSchema.safeParse(input));
  });

  it('the projection digest is stable under top-level key reordering (canonical form)', () => {
    if (PROJECTION === undefined) throw new Error('fixture parse failed');
    const { projectionDigest, ...content } = PROJECTION;
    expect(projectionDigest).toBe(canonicalDigest(content as unknown as JsonValue));
  });

  it('the observation digest is stable under top-level key reordering (canonical form)', () => {
    if (OBSERVATION === undefined) throw new Error('fixture parse failed');
    const { contentDigest, ...content } = OBSERVATION;
    expect(contentDigest).toBe(canonicalDigest(content as unknown as JsonValue));
  });

  it('record digests verify against their exact content (tamper detection)', () => {
    if (PROJECTION === undefined || OBSERVATION === undefined) throw new Error('fixture parse failed');
    expect(verifyProjection(PROJECTION)).toBe(true);
    expect(verifyObservation(OBSERVATION)).toBe(true);
    const tamperedProjection = {
      ...PROJECTION,
      assertionInputs: PROJECTION.assertionInputs.slice(0, -1),
    };
    expect(verifyProjection(tamperedProjection)).toBe(false);
  });
});
