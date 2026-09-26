// OBSERVATION INTAKE: W036 sealed observation records admitted into the
// tracking store with idempotency (the typed duplicate-observation
// admission returning the prior digest), the actualization-bypass guard
// (an ACTUAL record through the observation intake), the uncertainty
// pre-classifier, tenant isolation, and tamper detection.
import { describe, expect, it } from 'vitest';
import {
  admitObservation,
  deriveObservationReplayKey,
  sealDistinctionRecord,
  verifySealedDistinctionRecord,
} from '../src/index';
import {
  ACTIVITY_ID,
  DELIVERY_ID,
  OBSERVER,
  sealedActualRecord,
  sealedObservation,
  trackingStore,
  uncertainty,
} from './fixtures';
import { expectError, unwrap } from './helpers';

describe('observation admission (positive)', () => {
  it('admits a sealed W036 observation record', () => {
    const store = trackingStore();
    const record = sealedObservation();
    const admitted = unwrap(admitObservation(store, record));
    expect(admitted.outcome.kind).toBe('admitted');
    expect(admitted.store.observations).toHaveLength(1);
  });

  it('re-admitting the SAME payload under the SAME idempotency key is the typed duplicate-observation admission returning the prior digest', () => {
    const store = trackingStore();
    const record = sealedObservation();
    const first = unwrap(admitObservation(store, record, { idempotencyKey: 'replay-1' }));
    expect(first.outcome.kind).toBe('admitted');
    const replay = unwrap(admitObservation(first.store, record, { idempotencyKey: 'replay-1' }));
    expect(replay.outcome.kind).toBe('duplicate-observation');
    if (replay.outcome.kind === 'duplicate-observation') {
      expect(replay.outcome.observationDigest).toBe(record.contentDigest);
      expect(replay.outcome.record.contentDigest).toBe(record.contentDigest);
      expect(replay.outcome.idempotencyKey).toBe(
        deriveObservationReplayKey({
          tenantId: record.tenantId,
          idempotencyKey: 'replay-1',
        }),
      );
    }
    // The state is unchanged by the replay.
    expect(replay.store).toBe(first.store);
  });

  it('re-admitting the same record by id alone is also the duplicate-observation admission', () => {
    const store = trackingStore();
    const record = sealedObservation();
    const first = unwrap(admitObservation(store, record));
    const replay = unwrap(admitObservation(first.store, record));
    expect(replay.outcome.kind).toBe('duplicate-observation');
    expect(replay.store.observations).toHaveLength(1);
  });

  it('the observation records verify through the REAL W036 machinery', () => {
    const record = sealedObservation();
    expect(verifySealedDistinctionRecord(record).ok).toBe(true);
  });
});

describe('observation admission (negative)', () => {
  it('an ACTUAL record through the observation intake is actualization-bypass-rejected', () => {
    const store = trackingStore();
    const actual = sealedActualRecord();
    const error = expectError(admitObservation(store, actual));
    expect(error.code).toBe('actualization-bypass-rejected');
    expect((error as { recordKind?: string }).recordKind).toBe('actual');
    expect(error.message).toContain('W036 DeliveryRecord');
  });

  it('an actual-kind record BEFORE W036 verification is still actualization-bypass-rejected (kind gate first)', () => {
    const store = trackingStore();
    const error = expectError(admitObservation(store, { ...sealedActualRecord(), tenantId: 'garbage' }));
    expect(error.code).toBe('actualization-bypass-rejected');
  });

  it('a non-observation distinction kind is a typed validation failure', () => {
    const store = trackingStore();
    const forecast = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'forecast',
        recordId: 'forecast:brace-finish',
        tenantId: 'tenant:globex',
        subject: { solutionId: 'solution:tower-retrofit', subjectKind: 'activity', subjectId: ACTIVITY_ID },
        measure: { kind: 'quantity', value: '4', unit: 'tonne' },
        payload: { asOf: '2026-03-02T09:00:06.000Z', refines: null },
        recordedAt: '2026-03-02T09:00:06.000Z',
        recordedBy: OBSERVER,
        uncertainty: uncertainty(),
      }),
    );
    const error = expectError(admitObservation(store, forecast));
    expect(error.code).toBe('validation');
    expect(error.message).toContain('forecast');
  });

  it('a record without uncertainty is uncertainty-missing-rejected BEFORE validation', () => {
    const store = trackingStore();
    const record = sealedObservation();
    const error = expectError(admitObservation(store, { ...record, uncertainty: undefined }));
    expect(error.code).toBe('uncertainty-missing-rejected');
  });

  it('a record with a partial uncertainty state is uncertainty-missing-rejected (confidence missing)', () => {
    const store = trackingStore();
    const record = sealedObservation();
    const error = expectError(
      admitObservation(store, {
        ...record,
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed' },
          freshness: { state: 'fresh', assessedAt: '2026-03-02T09:00:01.000Z' },
        },
      }),
    );
    expect(error.code).toBe('uncertainty-missing-rejected');
    expect((error as { missing?: readonly string[] }).missing).toContain('confidence');
  });

  it('cross-tenant observation records are tenant-isolation-rejected', () => {
    const store = trackingStore();
    const foreign = sealedObservation({ tenantId: 'tenant:initech' });
    const error = expectError(admitObservation(store, foreign));
    expect(error.code).toBe('tenant-isolation-rejected');
    expect((error as { expectedTenantId?: string }).expectedTenantId).toBe('tenant:globex');
    expect((error as { encounteredTenantId?: string }).encounteredTenantId).toBe('tenant:initech');
  });

  it('a tampered observation digest is digest-mismatch (W036 tamper detection surfaced)', () => {
    const store = trackingStore();
    const record = sealedObservation();
    const tampered = { ...record, contentDigest: '0'.repeat(64) };
    const error = expectError(admitObservation(store, tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('the same id with different content is version-conflict (never a destructive overwrite)', () => {
    const store = trackingStore();
    const first = unwrap(admitObservation(store, sealedObservation()));
    const conflicting = sealedObservation({
      measure: { kind: 'quantity', value: '999', unit: 'm3' },
    });
    const error = expectError(admitObservation(first.store, conflicting));
    expect(error.code).toBe('version-conflict');
    expect((error as { publishedDigest?: string }).publishedDigest).toBe(first.store.observations[0]!.contentDigest);
  });

  it('the same idempotency key with different content is version-conflict (a key grounds one content)', () => {
    const store = trackingStore();
    const first = unwrap(admitObservation(store, sealedObservation(), { idempotencyKey: 'key-1' }));
    const other = sealedObservation({
      recordId: 'observation:pit-volume-2',
      measure: { kind: 'quantity', value: '110', unit: 'm3' },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: '2026-03-02T09:00:03.000Z',
        observedBy: OBSERVER,
        evidence: [{ digest: 'a'.repeat(64) }],
      },
    });
    const error = expectError(admitObservation(first.store, other, { idempotencyKey: 'key-1' }));
    expect(error.code).toBe('version-conflict');
    expect((error as { encounteredDigest?: string }).encounteredDigest).toBe(other.contentDigest);
  });
});
