// NEGATIVE: quotes — package digest drift, dangling packages, cross
// tenant, broken revision chains, lead-time distinction collapse, and
// schema discipline.
import { describe, expect, it } from 'vitest';
import {
  admitQuote,
  emptyQuoteStore,
  resolveLeadTimeObservation,
  sealQuote,
  verifySealedQuote,
  type LeadTimeObservation,
} from '../src/index';
import {
  T3,
  T5,
  leadTimeEstimate,
  leadTimePrediction,
  packageStore,
  quoteContent,
  sealedQuote,
  uncertainty,
  unwrap,
} from './fixtures';

describe('quotes (negative)', () => {
  it('a quote digest that drifts from the package revision is digest-mismatch', () => {
    const sealed = unwrap(sealQuote(quoteContent({ packageDigest: '0'.repeat(64) })));
    const admitted = admitQuote(packageStore(), emptyQuoteStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('digest-mismatch');
  });

  it('a quote over a missing package is dangling-reference-rejected (kind acquisition-package)', () => {
    const sealed = unwrap(
      sealQuote(quoteContent({ packageId: 'package:not-admitted' })),
    );
    const admitted = admitQuote(packageStore(), emptyQuoteStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-reference-rejected');
    if (admitted.error.code === 'dangling-reference-rejected') {
      expect(admitted.error.referenceKind).toBe('acquisition-package');
    }
  });

  it('a cross-tenant quote is tenant-isolation-rejected', () => {
    const sealed = unwrap(
      sealQuote(quoteContent({ tenantId: 'tenant:initech' })),
    );
    const admitted = admitQuote(packageStore(), emptyQuoteStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('tenant-isolation-rejected');
  });

  it('DISTINCTION COLLAPSE: an estimate-semantics lead time pointing at the PREDICTION record is rejected', () => {
    const prediction = leadTimePrediction();
    const sealed = sealQuote(
      quoteContent({
        leadTimes: [
          {
            semantics: 'estimate',
            recordId: prediction.recordId,
            contentDigest: prediction.contentDigest,
            uncertainty: uncertainty() as never,
          },
        ],
      }),
    );
    // The schema refinement itself rejects the prefix/semantics mismatch.
    expect(sealed.ok, JSON.stringify(sealed)).toBe(false);
  });

  it('a revision that skips the chain is version-conflict', () => {
    const packages = packageStore();
    const store = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const head = store.quotes[0]!;
    const skipped = unwrap(
      sealQuote(
        quoteContent({
          revision: 3,
          previousQuoteRevisionDigest: head.contentDigest,
        }),
      ),
    );
    const admitted = admitQuote(packages, store, skipped);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('version-conflict');
  });

  it('a revision chaining the WRONG digest is digest-mismatch', () => {
    const packages = packageStore();
    const store = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const wrong = unwrap(
      sealQuote(
        quoteContent({
          revision: 2,
          previousQuoteRevisionDigest: 'd'.repeat(64),
          submittedAt: T5,
        }),
      ),
    );
    const admitted = admitQuote(packages, store, wrong);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('digest-mismatch');
  });

  it('vendor fields cannot enter a quote (strict objects)', () => {
    const sealed = sealQuote(quoteContent({ supplierPortal: 'https://vendor.example' }));
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('vendor-fields-rejected');
  });

  it('a tampered quote digest is digest-mismatch at verification', () => {
    const sealed = sealedQuote();
    const tampered = { ...sealed, contentDigest: 'f'.repeat(64) };
    const verified = verifySealedQuote(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });

  it('lead-time records beyond Prediction/Estimate cannot serve (resolveLeadTimeObservation)', () => {
    const estimate = leadTimeEstimate();
    // Pretend the reference targets the estimate record with prediction
    // semantics (both records supplied): the resolver must reject.
    const observation: LeadTimeObservation = {
      semantics: 'prediction',
      recordId: estimate.recordId,
      contentDigest: estimate.contentDigest,
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'reported' },
        freshness: { state: 'fresh', assessedAt: T3 },
        confidence: { method: 'stated', value: 0.5 },
      },
    };
    const resolved = resolveLeadTimeObservation(observation, [estimate, leadTimePrediction()]);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.error.code).toBe('distinction-collapse-rejected');
  });
});
