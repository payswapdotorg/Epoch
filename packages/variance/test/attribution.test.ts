// ROOT-CAUSE ATTRIBUTION WITH EVIDENCE — the typed battery: evidence
// grounding, cause grammars, exact-revision variance binding, tenant
// isolation, and the named attribution-evidence-required guard.
import { describe, expect, it } from 'vitest';
import {
  admitAttributionRecord,
  causesOf,
  computeVariance,
  foldAttributionRecords,
  openAttributionLedger,
  requireAttributionEvidence,
  sealAttributionRecord,
  verifySealedAttributionRecord,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import {
  EVIDENCE_DIGEST,
  EVIDENCE_DIGEST_2,
  OTHER_TENANT,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  T4,
  attributionContent,
  varianceInput,
} from './fixtures';

describe('the attribution-evidence-required guard (the named test)', () => {
  it('attribution-evidence-required: an attribution with NO evidence is rejected', () => {
    const error = expectError(sealAttributionRecord(attributionContent({ evidence: [] })));
    expect(error.code).toBe('validation');
    const issue = (error as unknown as { issues: { message: string }[] }).issues[0]!;
    expect(issue.message).toContain('attribution-evidence-required');
    // The pre-classifier surfaces the TYPED code directly.
    const pre = expectError(requireAttributionEvidence(attributionContent({ evidence: [] })));
    expect(pre.code).toBe('attribution-evidence-required');
    expect(pre.message).toContain('inexpressible');
  });

  it('the typed guard names the variance and the evidence count', () => {
    const pre = expectError(
      requireAttributionEvidence(
        attributionContent({
          evidence: [],
          varianceRef: { recordId: 'variance:pit-volume-quantity', contentDigest: '3'.repeat(64) },
        }),
      ),
    );
    expect((pre as unknown as { varianceRecordId: string }).varianceRecordId).toBe(
      'variance:pit-volume-quantity',
    );
    expect((pre as unknown as { evidenceCount: number }).evidenceCount).toBe(0);
  });
});

describe('attribution with evidence (the positive path)', () => {
  it('seals, verifies, and admits a grounded attribution; replays idempotently', () => {
    const variance = unwrap(computeVariance(varianceInput() as never));
    let ledger = openAttributionLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const attribution = unwrap(
      sealAttributionRecord(
        attributionContent({
          varianceRef: {
            recordId: variance.varianceId,
            contentDigest: variance.contentDigest,
          },
        }),
      ),
    );
    ledger = unwrap(admitAttributionRecord(ledger, [variance], attribution));
    // Exact replay is idempotent.
    ledger = unwrap(admitAttributionRecord(ledger, [variance], attribution));
    expect(ledger.records.length).toBe(1);
    // The explainability view: causes of the variance.
    expect(causesOf(ledger, variance.varianceId).length).toBe(1);
    expect(foldAttributionRecords(ledger)[0]!.cause.causeKind).toBe('issue-record');
  });

  it('every cause kind is admissible (change record, W038 issue, external condition)', () => {
    const variance = unwrap(computeVariance(varianceInput() as never));
    let ledger = openAttributionLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const causes = [
      { causeKind: 'change-record', recordId: 'change:scope-addition', contentDigest: 'a'.repeat(64) },
      { causeKind: 'issue-record', recordId: 'delay:steel-delivery', contentDigest: 'b'.repeat(64) },
      { causeKind: 'issue-record', recordId: 'rework:weld-inspection', contentDigest: 'c'.repeat(64) },
      { causeKind: 'issue-record', recordId: 'defect:coating-blisters', contentDigest: 'd'.repeat(64) },
      { causeKind: 'issue-record', recordId: 'blocker:crane-permit', contentDigest: 'e'.repeat(64) },
      { causeKind: 'external-condition', recordId: 'condition:storm-eowyn', contentDigest: 'f'.repeat(64) },
    ];
    causes.forEach((cause, index) => {
      const attribution = unwrap(
        sealAttributionRecord(
          attributionContent({
            attributionId: `attribution:cause-${index}`,
            varianceRef: { recordId: variance.varianceId, contentDigest: variance.contentDigest },
            cause,
            evidence: [EVIDENCE_DIGEST, EVIDENCE_DIGEST_2],
          }),
        ),
      );
      ledger = unwrap(admitAttributionRecord(ledger, [variance], attribution));
    });
    expect(ledger.records.length).toBe(causes.length);
    expect(causesOf(ledger, variance.varianceId).length).toBe(causes.length);
  });

  it('a sealed attribution round-trips through JSON and verifies', () => {
    const attribution = unwrap(sealAttributionRecord(attributionContent()));
    const roundTrip = verifySealedAttributionRecord(JSON.parse(JSON.stringify(attribution)));
    expect(roundTrip.ok).toBe(true);
  });

  it('identical inputs derive identical digests (determinism)', () => {
    const a = unwrap(sealAttributionRecord(attributionContent()));
    const b = unwrap(sealAttributionRecord(attributionContent()));
    expect(a.contentDigest).toBe(b.contentDigest);
  });
});

describe('attribution negative guards', () => {
  it('a tampered attribution is a typed digest-mismatch', () => {
    const attribution = unwrap(sealAttributionRecord(attributionContent()));
    const tampered = { ...attribution, note: 'tampered' };
    const verified = verifySealedAttributionRecord(tampered);
    expect(verified.ok).toBe(false);
    expect(!verified.ok && verified.error.code).toBe('digest-mismatch');
  });

  it('tenant-isolation-rejected: a cross-tenant attribution', () => {
    const variance = unwrap(computeVariance(varianceInput() as never));
    const ledger = openAttributionLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const foreign = unwrap(
      sealAttributionRecord(attributionContent({ tenantId: OTHER_TENANT })),
    );
    const error = expectError(admitAttributionRecord(ledger, [variance], foreign));
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('dangling-reference-rejected: an attribution for an unknown variance', () => {
    const ledger = openAttributionLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const attribution = unwrap(sealAttributionRecord(attributionContent()));
    const error = expectError(admitAttributionRecord(ledger, [], attribution));
    expect(error.code).toBe('dangling-reference-rejected');
  });

  it('digest-mismatch: an attribution binding a stale variance revision', () => {
    const variance = unwrap(computeVariance(varianceInput() as never));
    const ledger = openAttributionLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const stale = unwrap(
      sealAttributionRecord(
        attributionContent({
          varianceRef: { recordId: variance.varianceId, contentDigest: '9'.repeat(64) },
        }),
      ),
    );
    const error = expectError(admitAttributionRecord(ledger, [variance], stale));
    expect(error.code).toBe('digest-mismatch');
  });

  it('version-conflict: the same attribution id with different content', () => {
    const variance = unwrap(computeVariance(varianceInput() as never));
    let ledger = openAttributionLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const first = unwrap(
      sealAttributionRecord(
        attributionContent({
          varianceRef: { recordId: variance.varianceId, contentDigest: variance.contentDigest },
        }),
      ),
    );
    ledger = unwrap(admitAttributionRecord(ledger, [variance], first));
    const different = unwrap(
      sealAttributionRecord(
        attributionContent({
          varianceRef: { recordId: variance.varianceId, contentDigest: variance.contentDigest },
          note: 'a different note changes the content',
        }),
      ),
    );
    const error = expectError(admitAttributionRecord(ledger, [variance], different));
    expect(error.code).toBe('version-conflict');
  });

  it('validation: malformed cause references are rejected', () => {
    const error = expectError(
      sealAttributionRecord(
        attributionContent({
          cause: { causeKind: 'issue-record', recordId: 'not-an-issue-id', contentDigest: 'a'.repeat(64) },
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('validation: a vendor field on the attribution is a vendor-fields rejection', () => {
    const error = expectError(
      sealAttributionRecord(attributionContent({ jiraTicket: 'ENG-42' })),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });
});

void T4;
void PRINCIPAL;
