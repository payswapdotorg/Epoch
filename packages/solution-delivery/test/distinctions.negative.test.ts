// NAMED NEGATIVES (the nine semantic distinctions): collapsing the
// distinctions into one mutable value (distinction-collapse-rejected); a
// forecast overwriting a historical prediction/baseline/actual
// (forecast-overwrite-rejected); immutable-content conflicts
// (version-conflict); cross-tenant admission; vendor fields; record-id
// prefix mismatches; tampered digests.
import { describe, expect, it } from 'vitest';
import {
  admitDistinctionRecord,
  sealDistinctionRecord,
  verifySealedDistinctionRecord,
} from '../src/index';
import { distinctionContents, emptyLedger, OTHER_TENANT } from './fixtures';

describe('NAMED NEGATIVE: distinction collapse (distinction-collapse-rejected)', () => {
  it('a record id changing kind is rejected (one id = one semantic distinction)', () => {
    const prediction = sealDistinctionRecord(distinctionContents().prediction);
    expect(prediction.ok).toBe(true);
    if (!prediction.ok) return;
    let ledger = emptyLedger();
    const admitted = admitDistinctionRecord(ledger, prediction.value);
    if (!admitted.ok) return;
    ledger = admitted.value;
    // The same record id re-admitted as an ACTUAL: collapsing the
    // distinction into one mutable value.
    const collapsed = sealDistinctionRecord({
      ...distinctionContents().actual,
      recordId: 'prediction:brace-tonnage',
    });
    expect(collapsed.ok).toBe(true);
    if (!collapsed.ok) return;
    const result = admitDistinctionRecord(ledger, collapsed.value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('distinction-collapse-rejected');
      if (result.error.code === 'distinction-collapse-rejected') {
        expect(result.error.publishedKind).toBe('prediction');
        expect(result.error.encounteredKind).toBe('actual');
      }
    }
  });

  it('a record id prefix that does not match its kind is a collapse at ledger admission', () => {
    const mismatched = sealDistinctionRecord({
      ...distinctionContents().actual,
      recordId: 'estimate:brace-tonnage',
    });
    expect(mismatched.ok).toBe(true);
    if (!mismatched.ok) return;
    const result = admitDistinctionRecord(emptyLedger(), mismatched.value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('distinction-collapse-rejected');
      if (result.error.code === 'distinction-collapse-rejected') {
        expect(result.error.publishedKind).toBe('estimate');
        expect(result.error.encounteredKind).toBe('actual');
      }
    }
  });
});

describe('NAMED NEGATIVE: forecast overwriting history (forecast-overwrite-rejected)', () => {
  it('a forecast refining a PREDICTION is rejected', () => {
    const prediction = sealDistinctionRecord(distinctionContents().prediction);
    if (!prediction.ok) return;
    let ledger = emptyLedger();
    const admitted = admitDistinctionRecord(ledger, prediction.value);
    if (!admitted.ok) return;
    ledger = admitted.value;
    const forecast = sealDistinctionRecord({
      ...distinctionContents().forecast,
      payload: { asOf: '2026-02-10T09:00:06.000Z', refines: 'prediction:brace-tonnage' },
    });
    if (!forecast.ok) return;
    const result = admitDistinctionRecord(ledger, forecast.value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('forecast-overwrite-rejected');
      if (result.error.code === 'forecast-overwrite-rejected') {
        expect(result.error.refinesKind).toBe('prediction');
      }
    }
  });

  it('a forecast refining a BASELINE is rejected', () => {
    const baseline = sealDistinctionRecord(distinctionContents().baseline);
    if (!baseline.ok) return;
    let ledger = emptyLedger();
    const admitted = admitDistinctionRecord(ledger, baseline.value);
    if (!admitted.ok) return;
    ledger = admitted.value;
    const forecast = sealDistinctionRecord({
      ...distinctionContents().forecast,
      payload: { asOf: '2026-02-10T09:00:06.000Z', refines: 'baseline:tower-v1' },
    });
    if (!forecast.ok) return;
    const result = admitDistinctionRecord(ledger, forecast.value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('forecast-overwrite-rejected');
      if (result.error.code === 'forecast-overwrite-rejected') {
        expect(result.error.refinesKind).toBe('baseline');
      }
    }
  });

  it('a forecast refining an ACTUAL is rejected', () => {
    const actual = sealDistinctionRecord(distinctionContents().actual);
    if (!actual.ok) return;
    let ledger = emptyLedger();
    const admitted = admitDistinctionRecord(ledger, actual.value);
    if (!admitted.ok) return;
    ledger = admitted.value;
    const forecast = sealDistinctionRecord({
      ...distinctionContents().forecast,
      payload: { asOf: '2026-02-10T09:00:06.000Z', refines: 'actual:pit-volume' },
    });
    if (!forecast.ok) return;
    const result = admitDistinctionRecord(ledger, forecast.value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('forecast-overwrite-rejected');
      if (result.error.code === 'forecast-overwrite-rejected') {
        expect(result.error.refinesKind).toBe('actual');
      }
    }
  });

  it('a forecast refining a missing record is rejected', () => {
    const forecast = sealDistinctionRecord({
      ...distinctionContents().forecast,
      payload: { asOf: '2026-02-10T09:00:06.000Z', refines: 'forecast:ghost' },
    });
    if (!forecast.ok) return;
    const result = admitDistinctionRecord(emptyLedger(), forecast.value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('forecast-overwrite-rejected');
      if (result.error.code === 'forecast-overwrite-rejected') {
        expect(result.error.refinesKind).toBe('missing');
      }
    }
  });
});

describe('NAMED NEGATIVE: immutable records (version-conflict)', () => {
  it('the same id with different content and the same kind is rejected', () => {
    const prediction = sealDistinctionRecord(distinctionContents().prediction);
    if (!prediction.ok) return;
    let ledger = emptyLedger();
    const admitted = admitDistinctionRecord(ledger, prediction.value);
    if (!admitted.ok) return;
    ledger = admitted.value;
    const mutated = sealDistinctionRecord({
      ...distinctionContents().prediction,
      measure: { kind: 'quantity', value: '5', unit: 'tonne' },
    });
    if (!mutated.ok) return;
    const result = admitDistinctionRecord(ledger, mutated.value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('version-conflict');
    }
  });
});

describe('NAMED NEGATIVE: cross-tenant admission (cross-tenant-denied)', () => {
  it('a record from another tenant is rejected', () => {
    const prediction = sealDistinctionRecord({
      ...distinctionContents().prediction,
      tenantId: OTHER_TENANT,
    });
    if (!prediction.ok) return;
    const result = admitDistinctionRecord(emptyLedger(), prediction.value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cross-tenant-denied');
    }
  });
});

describe('NAMED NEGATIVE: vendor fields and tampering', () => {
  it('vendor fields on a distinction record are rejected', () => {
    const sealed = sealDistinctionRecord({
      ...distinctionContents().prediction,
      supplierName: 'BigSteel Co',
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('a tampered digest is rejected', () => {
    const sealed = sealDistinctionRecord(distinctionContents().prediction);
    if (!sealed.ok) return;
    const tampered = { ...sealed.value, measure: { kind: 'quantity', value: '99', unit: 'tonne' } };
    const verified = verifySealedDistinctionRecord(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a missing uncertainty state is rejected (uncertainty is mandatory on facts)', () => {
    const content = { ...distinctionContents().prediction } as Record<string, unknown>;
    delete content['uncertainty'];
    const sealed = sealDistinctionRecord(content);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });
});
