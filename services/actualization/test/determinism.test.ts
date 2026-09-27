// DETERMINISM: two runtimes fed the same operations (in different
// intake orders) hold byte-identical state — digests, streams, and the
// derived projections agree.
import { describe, expect, it } from 'vitest';
import { ActualizationRuntime, seededObservationSource } from '../src/index';
import {
  ACTIVITY_ID,
  DELIVERY_ID,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  T4,
  T5,
  T6,
  T7,
  allowContext,
  openedDelivery,
  sealedObservation,
  tuesdayObservation,
  sealedComparisonFact,
  unwrap,
} from './helpers';

const AUTH = { principalId: PRINCIPAL, context: allowContext() };
const POLICY = { mode: 'exact' } as const;

interface RunDigest {
  readonly deliveryDigest: string;
  readonly streamDigest: string;
  readonly health: string;
  readonly projectionDigest: string;
}

/** Run the full flow on a fresh host and return the deterministic digest. */
function runFlow(order: 'monday-first' | 'tuesday-first'): RunDigest {
  const host = new ActualizationRuntime();
  unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
  const observations =
    order === 'monday-first'
      ? [sealedObservation(), tuesdayObservation()]
      : [tuesdayObservation(), sealedObservation()];
  for (const observation of observations) {
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation,
      }),
    );
  }
  const assessments = unwrap(
    host.assessValidation({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      policy: POLICY,
      assessedAt: T4,
    }),
  );
  unwrap(
    host.applyActualization({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      assessment: assessments[0]!,
      application: { acceptedBy: PRINCIPAL, acceptedAt: T4, actualizedBy: PRINCIPAL, actualizedAt: T5 },
    }),
  );
  unwrap(
    host.admitComparisonFact({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      fact: sealedComparisonFact(),
    }),
  );
  unwrap(
    host.foldCalibration({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_ID,
      foldedAt: T7,
    }),
  );
  const projected = unwrap(
    host.projectState({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      policy: POLICY,
      projectedAt: T7,
    }),
  );
  const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
  return {
    deliveryDigest: projected.deliveryDigest,
    streamDigest: JSON.stringify(stream.map((event) => [event.sequence, event.payload.discriminator, event.contentDigest])),
    health: JSON.stringify(host.health()),
    projectionDigest: JSON.stringify(projected),
  };
}

describe('runtime determinism (identical operations -> byte-identical state)', () => {
  it('two runtimes fed the same flow in the SAME order hold byte-identical streams', () => {
    const a = runFlow('monday-first');
    const b = runFlow('monday-first');
    expect(a.deliveryDigest).toBe(b.deliveryDigest);
    expect(a.streamDigest).toBe(b.streamDigest);
    expect(a.health).toBe(b.health);
    expect(a.projectionDigest).toBe(b.projectionDigest);
  });

  it('different intake orders derive identical STATE (the stream is order-bearing by design)', () => {
    const a = runFlow('monday-first');
    const b = runFlow('tuesday-first');
    // The derived state folds are order-invariant.
    expect(a.deliveryDigest).toBe(b.deliveryDigest);
    expect(a.health).toBe(b.health);
    expect(a.projectionDigest).toBe(b.projectionDigest);
    // The event streams carry the same lifecycle facts as multisets
    // (sequence position reflects operation order — by W010 design).
    const discriminatorsOf = (digest: string): string[] =>
      JSON.parse(digest).map((entry: [number, string, string]) => entry[1]).sort();
    expect(discriminatorsOf(a.streamDigest)).toEqual(discriminatorsOf(b.streamDigest));
  });

  it('the seeded port intake derives the same stream as the direct intake', () => {
    const direct = new ActualizationRuntime();
    unwrap(direct.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    for (const observation of [sealedObservation(), tuesdayObservation()]) {
      unwrap(
        direct.intakeObservation({
          tenantId: TENANT,
          authorization: AUTH,
          deliveryId: DELIVERY_ID,
          observation,
        }),
      );
    }
    const polled = new ActualizationRuntime({
      observationSourcePort: seededObservationSource([
        { tenantId: TENANT, deliveryId: DELIVERY_ID, observation: sealedObservation() },
        { tenantId: TENANT, deliveryId: DELIVERY_ID, observation: tuesdayObservation() },
      ]),
    });
    unwrap(polled.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    unwrap(
      polled.pollObservationSources({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        requestedAt: T4,
      }),
    );
    const streamA = unwrap(direct.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    const streamB = unwrap(polled.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    expect(streamB.map((e) => [e.payload.discriminator, e.contentDigest])).toEqual(
      streamA.map((e) => [e.payload.discriminator, e.contentDigest]),
    );
  });

  it('forecast revisions are an append-only chain through the host (re-emission conflicts)', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    const baseInput = {
      subject: { solutionId: SOLUTION_ID, subjectKind: 'activity' as const, subjectId: ACTIVITY_ID },
      planned: { kind: 'quantity' as const, value: '120', unit: 'm3' },
      actualsToDate: { kind: 'quantity' as const, value: '60', unit: 'm3' },
      performanceFactor: '1.25',
      asOf: T4,
      recordedAt: T4,
      recordedBy: PRINCIPAL,
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'derived' },
        freshness: { state: 'fresh', assessedAt: T4 },
        confidence: { method: 'estimated', value: 0.7 },
      },
    };
    const first = unwrap(
      host.reviseForecast({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        solutionId: SOLUTION_ID,
        input: { ...baseInput, recordId: 'forecast:pit-volume-r1' },
        revisedAt: T4,
      }),
    );
    // The next revision chains onto r1 (refines r1).
    const second = unwrap(
      host.reviseForecast({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        solutionId: SOLUTION_ID,
        input: { ...baseInput, recordId: 'forecast:pit-volume-r2', asOf: T6 },
        revisedAt: T6,
      }),
    );
    expect(host.health().forecastRevisionCount).toBe(2);
    // Re-emitting the SAME record id after the chain moved on is the
    // typed version-conflict (the host derives refines from the ledger,
    // so the same id + new chain position = different content).
    const reemission = host.reviseForecast({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      solutionId: SOLUTION_ID,
      input: { ...baseInput, recordId: 'forecast:pit-volume-r1' },
      revisedAt: T7,
    });
    expect(reemission.ok).toBe(false);
    expect(!reemission.ok && reemission.error.code).toBe('version-conflict');
    void second;
    void first;
  });
});
