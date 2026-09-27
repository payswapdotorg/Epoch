// ROLLING COMPLETION AND COST FORECASTS — the deterministic forecast
// battery: exact decimal folds, revision chaining through the W036
// ledger (refines earlier forecasts ONLY), replay idempotence, and the
// forecast-overwrite guard.
import { describe, expect, it } from 'vitest';
import {
  admitForecastRevision,
  rollForecast,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import {
  ACTIVITY_ID,
  SOLUTION_ID,
  TENANT,
  T2,
  T3,
  T4,
  T5,
  T6,
  uncertainty,
} from './fixtures';

function forecastInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recordId: 'forecast:pit-volume-r1',
    tenantId: TENANT,
    subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
    planned: { kind: 'quantity', value: '120', unit: 'm3' },
    actualsToDate: { kind: 'quantity', value: '60', unit: 'm3' },
    asOf: T4,
    refines: null,
    recordedAt: T4,
    recordedBy: 'principal:delivery-lead',
    uncertainty: uncertainty(),
    ...overrides,
  };
}

describe('the rolling forecast computation (exact fixed-point decimals)', () => {
  it('rolls a completion forecast: remaining = planned - actual, atCompletion = actual + remaining x factor', () => {
    const detail = unwrap(
      rollForecast(forecastInput({ performanceFactor: '1.25' }) as never),
    );
    // remaining = 120 - 60 = 60; atCompletion = 60 + 60 x 1.25 = 135.
    expect(detail.remaining).toBe('60');
    expect(detail.atCompletion).toBe('135');
    expect(detail.performanceFactor).toBe('1.25');
    expect(detail.planExhausted).toBe(false);
    expect(detail.record.kind).toBe('forecast');
    const record = detail.record as {
      kind: 'forecast';
      measure: { kind: string; value: string; unit: string };
      payload: { asOf: string; refines: string | null };
    };
    expect(record.measure).toEqual({ kind: 'quantity', value: '135', unit: 'm3' });
    expect(record.payload.asOf).toBe(T4);
    expect(record.payload.refines).toBeNull();
  });

  it('rolls a cost forecast in the plan currency', () => {
    const detail = unwrap(
      rollForecast(
        forecastInput({
          recordId: 'forecast:pit-cost-r1',
          planned: { kind: 'cost', amount: '2220', currency: 'EUR' },
          actualsToDate: { kind: 'cost', amount: '1107.75', currency: 'EUR' },
        }) as never,
      ),
    );
    // remaining = 2220 - 1107.75 = 1112.25; atCompletion = 1107.75 + 1112.25 = 2220 (factor 1).
    expect(detail.remaining).toBe('1112.25');
    expect(detail.atCompletion).toBe('2220');
    expect((detail.record as { measure: unknown }).measure).toEqual({
      kind: 'cost',
      amount: '2220',
      currency: 'EUR',
    });
  });

  it('clamps the remaining plan at zero when actuals exhaust the plan', () => {
    const detail = unwrap(
      rollForecast(
        forecastInput({
          planned: { kind: 'quantity', value: '50', unit: 'm3' },
          actualsToDate: { kind: 'quantity', value: '60', unit: 'm3' },
        }) as never,
      ),
    );
    expect(detail.remaining).toBe('0');
    expect(detail.atCompletion).toBe('60');
    expect(detail.planExhausted).toBe(true);
  });

  it('identical inputs derive identical digests (determinism)', () => {
    const first = unwrap(rollForecast(forecastInput() as never));
    const second = unwrap(rollForecast(forecastInput() as never));
    expect(first.record.contentDigest).toBe(second.record.contentDigest);
  });

  it('measure-kind and unit/currency mismatches are typed validation rejections', () => {
    const kindMismatch = expectError(
      rollForecast(
        forecastInput({
          planned: { kind: 'cost', amount: '100', currency: 'EUR' },
          actualsToDate: { kind: 'quantity', value: '60', unit: 'm3' },
        }) as never,
      ),
    );
    expect(kindMismatch.code).toBe('validation');
    const unitMismatch = expectError(
      rollForecast(
        forecastInput({
          actualsToDate: { kind: 'quantity', value: '60', unit: 'tonne' },
        }) as never,
      ),
    );
    expect(unitMismatch.code).toBe('validation');
    const badFactor = expectError(
      rollForecast(forecastInput({ performanceFactor: '1.1.0' }) as never),
    );
    expect(badFactor.code).toBe('validation');
  });
});

describe('forecast-revision admission (append-only, refines forecasts only)', () => {
  it('emits revision chains: r1 admitted, r2 refines r1, exact re-admission idempotent', () => {
    const ledger = { tenantId: TENANT, solutionId: SOLUTION_ID, records: [] } as never;
    let current = unwrap(admitForecastRevision(ledger, unwrap(rollForecast(forecastInput() as never)).record));
    const r1 = current.records[current.records.length - 1]!;
    const r2Detail = unwrap(
      rollForecast(
        forecastInput({
          recordId: 'forecast:pit-volume-r2',
          actualsToDate: { kind: 'quantity', value: '100', unit: 'm3' },
          performanceFactor: '1.5',
          asOf: T5,
          refines: { recordId: r1.recordId, contentDigest: r1.contentDigest },
        }) as never,
      ),
    );
    current = unwrap(admitForecastRevision(current, r2Detail.record));
    expect(current.records.length).toBe(2);
    // Replay: exact re-admission is idempotent.
    current = unwrap(admitForecastRevision(current, r2Detail.record));
    expect(current.records.length).toBe(2);
    // The refinement chain is visible in the payload.
    expect((r2Detail.record.payload as { refines: string }).refines).toBe('forecast:pit-volume-r1');
  });

  it('forecast-overwrite-rejected: refining a non-forecast record', () => {
    const ledger = { tenantId: TENANT, solutionId: SOLUTION_ID, records: [] } as never;
    const rogue = unwrap(
      rollForecast(
        forecastInput({
          recordId: 'forecast:rogue-refinement',
          refines: { recordId: 'baseline:pit-volume-v1', contentDigest: '2'.repeat(64) },
        }) as never,
      ),
    );
    const error = expectError(admitForecastRevision(ledger, rogue.record));
    expect(error.code).toBe('forecast-overwrite-rejected');
  });

  it('forecast-overwrite-rejected: refining a missing record', () => {
    const ledger = { tenantId: TENANT, solutionId: SOLUTION_ID, records: [] } as never;
    const orphan = unwrap(
      rollForecast(
        forecastInput({
          recordId: 'forecast:orphan-refinement',
          refines: { recordId: 'forecast:does-not-exist', contentDigest: '3'.repeat(64) },
        }) as never,
      ),
    );
    const error = expectError(admitForecastRevision(ledger, orphan.record));
    expect(error.code).toBe('forecast-overwrite-rejected');
  });

  it('version-conflict: the same forecast id with different content', () => {
    const ledger = { tenantId: TENANT, solutionId: SOLUTION_ID, records: [] } as never;
    const current = unwrap(admitForecastRevision(ledger, unwrap(rollForecast(forecastInput() as never)).record));
    const mutated = unwrap(
      rollForecast(forecastInput({ performanceFactor: '1.5' }) as never),
    );
    const error = expectError(admitForecastRevision(current, mutated.record));
    expect(error.code).toBe('version-conflict');
  });

  it('the forecast revision carries the typed confidence state (W006-shaped)', () => {
    const detail = unwrap(rollForecast(forecastInput() as never));
    const uncertaintyState = detail.record.uncertainty as {
      confidence: { method: string; value: number };
    };
    expect(uncertaintyState.confidence.method).toBe('measured');
    expect(uncertaintyState.confidence.value).toBe(0.92);
  });
});

void T2;
void T3;
void T6;
