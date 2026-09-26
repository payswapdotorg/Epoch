// COMMITMENT LINKAGE: procurement creates/links W036
// Commitment-distinction records through the REAL W036 kernel — never
// re-implementing them. Positive linkage + distinction collapse + the
// W036 DistinctionLedger admission (byte-for-byte W036 records).
import { describe, expect, it } from 'vitest';
import {
  admitDistinctionRecord,
  sealDistinctionRecord,
  type DistinctionLedger,
  type SealedDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  foldQuoteCost,
  linkProcurementCommitment,
  procurementCommitmentContent,
  sealProcurementCommitment,
  type CommitmentLinkage,
} from '../src/index';
import {
  ACQUISITION_ID,
  COMMITMENT_ID,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  T4,
  T5,
  sealedQuote,
  uncertainty,
  unwrap,
} from './fixtures';

const SUBJECT = { solutionId: SOLUTION_ID, subjectKind: 'solution' as const, subjectId: SOLUTION_ID };

function commitment(): SealedDistinctionRecord {
  return unwrap(
    sealProcurementCommitment({
      recordId: COMMITMENT_ID,
      tenantId: TENANT,
      subject: SUBJECT,
      quote: sealedQuote(),
      acquisitionId: ACQUISITION_ID,
      committedBy: PRINCIPAL,
      committedAt: T4,
      recordedAt: T4,
      uncertainty: uncertainty() as never,
    }),
  );
}

describe('commitment linkage (W036 records, linked not re-implemented)', () => {
  it('the commitment content builder produces a W036 COMMITMENT record content', () => {
    const content = unwrap(
      procurementCommitmentContent({
        recordId: COMMITMENT_ID,
        tenantId: TENANT,
        subject: SUBJECT,
        quote: sealedQuote(),
        acquisitionId: ACQUISITION_ID,
        committedBy: PRINCIPAL,
        committedAt: T4,
        recordedAt: T4,
        uncertainty: uncertainty() as never,
      }),
    );
    expect(content.kind).toBe('commitment');
    expect(content.schema).toBe('epoch.solution-delivery.distinction-record');
  });

  it('sealProcurementCommitment seals through the REAL W036 kernel (byte-for-byte W036 record)', () => {
    const sealed = commitment();
    expect(sealed.kind).toBe('commitment');
    // The REAL W036 DistinctionLedger admits the record as-is.
    const ledger: DistinctionLedger = {
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      records: [],
    };
    const admitted = admitDistinctionRecord(ledger, sealed);
    expect(admitted.ok, JSON.stringify(admitted)).toBe(true);
  });

  it('linkProcurementCommitment verifies kind, tenant, acquisition link and the exact quote fold', () => {
    const quote = sealedQuote();
    const folded = unwrap(foldQuoteCost(quote));
    const linkage = unwrap(linkProcurementCommitment(commitment(), quote, ACQUISITION_ID));
    expect(linkage.reference.recordId).toBe(COMMITMENT_ID);
    expect(linkage.committedMeasure).toEqual(folded);
    expect(linkage.committedBy).toBe(PRINCIPAL);
    expect(linkage.committedAt).toBe(T4);
  });

  it('DISTINCTION COLLAPSE: a non-commitment record cannot ground the link', () => {
    const prediction = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'prediction',
        recordId: 'prediction:not-a-commitment',
        tenantId: TENANT,
        subject: SUBJECT,
        measure: { kind: 'cost', amount: '10', currency: 'EUR' },
        payload: {},
        recordedAt: T4,
        recordedBy: PRINCIPAL,
        uncertainty: uncertainty() as never,
      } as never),
    );
    const linked = linkProcurementCommitment(prediction, sealedQuote(), ACQUISITION_ID);
    expect(linked.ok).toBe(false);
    if (linked.ok) return;
    expect(linked.error.code).toBe('distinction-collapse-rejected');
    if (linked.error.code === 'distinction-collapse-rejected') {
      expect(linked.error.expectedKind).toBe('commitment');
      expect(linked.error.encounteredKind).toBe('prediction');
    }
  });

  it('a cross-tenant commitment is tenant-isolation-rejected', () => {
    const foreign = unwrap(
      sealProcurementCommitment({
        recordId: 'commitment:foreign-tenant',
        tenantId: 'tenant:initech',
        subject: { ...SUBJECT, solutionId: 'solution:other' },
        quote: { ...sealedQuote(), tenantId: 'tenant:globex' },
        acquisitionId: ACQUISITION_ID,
        committedBy: PRINCIPAL,
        committedAt: T4,
        recordedAt: T4,
        uncertainty: uncertainty() as never,
      }),
    );
    const linked = linkProcurementCommitment(foreign, sealedQuote(), ACQUISITION_ID);
    expect(linked.ok).toBe(false);
    if (linked.ok) return;
    expect(linked.error.code).toBe('tenant-isolation-rejected');
  });

  it('a commitment linking the WRONG acquisition request is validation', () => {
    const commitmentWrongLink = unwrap(
      sealProcurementCommitment({
        recordId: 'commitment:wrong-acquisition',
        tenantId: TENANT,
        subject: SUBJECT,
        quote: sealedQuote(),
        acquisitionId: 'acquisition:some-other-request',
        committedBy: PRINCIPAL,
        committedAt: T4,
        recordedAt: T4,
        uncertainty: uncertainty() as never,
      }),
    );
    const linked = linkProcurementCommitment(commitmentWrongLink, sealedQuote(), ACQUISITION_ID);
    expect(linked.ok).toBe(false);
    if (linked.ok) return;
    expect(linked.error.code).toBe('validation');
  });

  it('a commitment whose measure drifted from the quote fold is validation', () => {
    const drifted = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'commitment',
        recordId: 'commitment:drifted-measure',
        tenantId: TENANT,
        subject: SUBJECT,
        measure: { kind: 'cost', amount: '1', currency: 'EUR' },
        payload: { committedBy: PRINCIPAL, committedAt: T5, acquisitionId: ACQUISITION_ID },
        recordedAt: T5,
        recordedBy: PRINCIPAL,
        uncertainty: uncertainty() as never,
      } as never),
    );
    const linked = linkProcurementCommitment(drifted, sealedQuote(), ACQUISITION_ID);
    expect(linked.ok).toBe(false);
    if (linked.ok) return;
    expect(linked.error.code).toBe('validation');
    void (null as unknown as CommitmentLinkage);
  });
});
