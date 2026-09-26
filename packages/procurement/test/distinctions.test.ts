// SEMANTIC-DISTINCTION SEPARATION (the acceptance pin: "explicit
// separation of prediction/baseline/commitment/actual values"):
// every value that is a prediction vs estimate vs baseline vs
// commitment vs actual is a TYPED reference to the right W036
// distinction kind — collapsing them is `distinction-collapse-rejected`
// (the W036 typed-rejection convention, reused).
import { describe, expect, it } from 'vitest';
import { sealDistinctionRecord } from '@epoch/solution-delivery';
import {
  linkProcurementCommitment,
  resolveLeadTimeObservation,
  sealProcurementCommitment,
  type LeadTimeObservation,
} from '../src/index';
import {
  ACQUISITION_ID,
  SOLUTION_ID,
  TENANT,
  T4,
  sealedQuote,
  uncertainty,
  unwrap,
} from './fixtures';

const SUBJECT = { solutionId: SOLUTION_ID, subjectKind: 'solution' as const, subjectId: SOLUTION_ID };

/** Seal one W036 distinction record of an arbitrary kind (kind-correct payloads). */
function recordOf(kind: string, recordId: string, measure?: Record<string, unknown>): import('@epoch/solution-delivery').SealedDistinctionRecord {
  const payloadByKind: Record<string, unknown> = {
    baseline: { solutionVersion: '1.0.0', solutionVersionDigest: 'b'.repeat(64) },
    outcome: { outcomeKind: 'delivered', verificationRefs: [] },
    learning: { lesson: 'Lead-time estimates need supplier confirmation.', links: [] },
    commitment: { committedBy: 'principal:procurement-lead', committedAt: T4 },
    observation: {
      deliveryId: 'delivery:tower-retrofit-v1',
      observedAt: T4,
      observedBy: 'principal:field-engineer',
      evidence: [],
    },
    actual: {
      deliveryId: 'delivery:tower-retrofit-v1',
      derivedFromObservationId: 'observation:delivery-receipt-1',
      actualizedAt: T4,
      actualizedBy: 'principal:procurement-lead',
    },
    forecast: { asOf: T4, refines: null },
  };
  const base: Record<string, unknown> = {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind,
    recordId,
    tenantId: TENANT,
    subject: SUBJECT,
    payload: payloadByKind[kind] ?? {},
    recordedAt: T4,
    recordedBy: 'principal:procurement-lead',
    uncertainty: uncertainty(),
  };
  const MEASURE_BEARING = ['prediction', 'estimate', 'commitment', 'observation', 'actual', 'forecast'];
  if (measure !== undefined && MEASURE_BEARING.includes(kind)) {
    base.measure = measure;
  }
  return unwrap(sealDistinctionRecord(base as never));
}

describe('semantic-distinction separation (prediction/estimate/baseline/commitment/actual kept apart)', () => {
  it('the nine W036 distinction kinds are kept apart in procurement references', () => {
    // Lead-time observations accept ONLY prediction/estimate semantics.
    const prediction = recordOf('prediction', 'prediction:lead-x', { kind: 'quantity', value: '10', unit: 'day' });
    const estimate = recordOf('estimate', 'estimate:lead-x', { kind: 'quantity', value: '12', unit: 'day' });
    const baseline = recordOf('baseline', 'baseline:lead-x');
    const commitment = recordOf('commitment', 'commitment:lead-x', { kind: 'cost', amount: '100', currency: 'EUR' });
    const actual = recordOf('actual', 'actual:lead-x', { kind: 'quantity', value: '11', unit: 'day' });
    const observation = recordOf('observation', 'observation:lead-x', { kind: 'quantity', value: '11', unit: 'day' });
    const forecast = recordOf('forecast', 'forecast:lead-x', { kind: 'quantity', value: '9', unit: 'day' });
    const outcome = recordOf('outcome', 'outcome:lead-x');
    const learning = recordOf('learning', 'learning:lead-x');

    const records = [prediction, estimate, baseline, commitment, actual, observation, forecast, outcome, learning];
    const byId = (id: string): LeadTimeObservation => ({
      semantics: 'estimate',
      recordId: id,
      contentDigest: records.find((record) => record.recordId === id)!.contentDigest,
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'reported' },
        freshness: { state: 'fresh', assessedAt: T4 },
        confidence: { method: 'stated', value: 0.5 },
      },
    });

    // estimate semantics resolves against the estimate record...
    const good = resolveLeadTimeObservation(byId('estimate:lead-x'), records);
    expect(good.ok).toBe(true);
    // ...and COLLAPSES against every other kind.
    for (const id of [
      'prediction:lead-x',
      'baseline:lead-x',
      'commitment:lead-x',
      'actual:lead-x',
      'observation:lead-x',
      'forecast:lead-x',
      'outcome:lead-x',
      'learning:lead-x',
    ]) {
      const resolved = resolveLeadTimeObservation(byId(id), records);
      expect(resolved.ok, id).toBe(false);
      if (resolved.ok) continue;
      expect(resolved.error.code, id).toBe('distinction-collapse-rejected');
    }
  });

  it('commitment linkage collapses against every non-commitment kind', () => {
    const quote = sealedQuote();
    const folded = '2356.1';
    const kinds = [
      ['prediction', 'prediction:not-commitment'],
      ['estimate', 'estimate:not-commitment'],
      ['baseline', 'baseline:not-commitment'],
      ['observation', 'observation:not-commitment'],
      ['actual', 'actual:not-commitment'],
      ['forecast', 'forecast:not-commitment'],
      ['outcome', 'outcome:not-commitment'],
      ['learning', 'learning:not-commitment'],
    ] as const;
    for (const [kind, recordId] of kinds) {
      const record = recordOf(kind, recordId, { kind: 'cost', amount: folded, currency: 'EUR' });
      const linked = linkProcurementCommitment(record, quote, ACQUISITION_ID);
      expect(linked.ok, kind).toBe(false);
      if (linked.ok) continue;
      expect(linked.error.code, kind).toBe('distinction-collapse-rejected');
      if (linked.error.code === 'distinction-collapse-rejected') {
        expect(linked.error.expectedKind).toBe('commitment');
      }
    }
  });

  it('a REAL W036 commitment record links cleanly (the only acceptable kind)', () => {
    const commitment = unwrap(
      sealProcurementCommitment({
        recordId: 'commitment:earthworks-order-1',
        tenantId: TENANT,
        subject: SUBJECT,
        quote: sealedQuote(),
        acquisitionId: ACQUISITION_ID,
        committedBy: 'principal:procurement-lead',
        committedAt: T4,
        recordedAt: T4,
        uncertainty: uncertainty() as never,
      }),
    );
    const linked = unwrap(linkProcurementCommitment(commitment, sealedQuote(), ACQUISITION_ID));
    expect(linked.reference.recordId).toBe('commitment:earthworks-order-1');
  });
});
