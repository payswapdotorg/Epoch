// Acceptance 6 + negative (c): a discovered external model remains
// NON-CONSEQUENTIAL until the sandbox/profile/evaluation/policy gates
// pass; an unverified candidate can NEVER pass the promotion gate.
import { describe, expect, it } from 'vitest';
import { ingestExternalCandidate, promoteCandidate, verifyPromotionChain } from '../src/candidates';
import { isConsequentialEligible } from '../src/organization';
import { contentDigest } from '../src/canonical';
import type { CandidateProfile, PromotionRecord } from '../src/types';
import { expectFailure, op, sourceArtifact } from './fixtures';

function ingestedCandidate(): CandidateProfile {
  const outcome = ingestExternalCandidate({
    tenantId: 'tenant:alpha',
    adapterId: 'fixture-catalog',
    artifact: sourceArtifact({
      artifactId: 'testgen-artifact',
      summary: 'Claims test generation with measured quality',
      claims: [
        {
          operation: op('software.test-generation'),
          inputKinds: ['code'],
          outputKinds: ['code'],
          quality: { metric: 'pass-rate', threshold: 0.9, unit: 'ratio', direction: 'min' },
        },
      ],
    }),
  });
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.value;
}

const PASSING_SANDBOX = {
  passed: true,
  isolationLevel: 'vm' as const,
  findings: ['no escape observed'],
};

const PASSING_EVIDENCE = [
  {
    operation: op('software.test-generation'),
    metric: 'pass-rate',
    value: 0.93,
    unit: 'ratio',
    passed: true,
    evidenceDigest: 'f'.repeat(64),
  },
];

const POLICY_APPROVAL = { approvedBy: 'principal:security-lead', policyRef: 'policy:external-model-v1' };

describe('acceptance 6 — the safe ingestion boundary', () => {
  it('ingests external artifacts as discovered + sandbox-required + external trust domain', () => {
    const candidate = ingestedCandidate();
    expect(candidate.evaluationState).toBe('discovered');
    expect(candidate.security.sandboxRequired).toBe(true);
    expect(candidate.security.trustDomain).toBe('external');
    expect(candidate.kind).toBe('external');
    expect(candidate.provenance.external).toEqual({
      adapterId: 'fixture-catalog',
      artifactId: 'testgen-artifact',
    });
    // Claims are recorded as DECLARED at the boundary (external
    // self-descriptions are never trusted as measurements).
    expect(candidate.claimedCapabilities[0]!.claimBasis).toBe('declared');
    // NOT consequential-eligible.
    expect(isConsequentialEligible(candidate)).toBe(false);
  });

  it('the candidate id is content-addressed (same artifact -> same id, dedupe anchor)', () => {
    const first = ingestedCandidate();
    const second = ingestedCandidate();
    expect(second.candidateId).toBe(first.candidateId);
  });
});

describe('negative (c) — the promotion gate', () => {
  it('rejects jumping discovered -> verified (unverified candidate can never pass)', () => {
    const candidate = ingestedCandidate();
    const jump = promoteCandidate({
      candidate,
      targetState: 'verified',
      evidenceDigest: contentDigest({ note: 'jump attempt' }),
      policyApproval: POLICY_APPROVAL,
      at: '2026-10-06T09:00:00.000Z',
      previousPromotionDigest: null,
    });
    expect(jump.ok).toBe(false);
    if (jump.ok) throw new Error('expected failure');
    expect(jump.error.message).toContain('discovered -> verified');
    expectFailure(jump, 'promotion-gate-rejected');
  });

  it('rejects skipping the sandbox (discovered -> profiled)', () => {
    const candidate = ingestedCandidate();
    const skip = promoteCandidate({
      candidate,
      targetState: 'profiled',
      evidenceDigest: contentDigest({ note: 'skip sandbox' }),
      at: '2026-10-06T09:00:00.000Z',
      previousPromotionDigest: null,
    });
    expectFailure(skip, 'promotion-gate-rejected');
  });

  it('rejects sandbox promotion without a passing, isolated sandbox report', () => {
    const candidate = ingestedCandidate();
    const noReport = promoteCandidate({
      candidate,
      targetState: 'sandboxed',
      evidenceDigest: contentDigest({}),
      at: '2026-10-06T09:00:00.000Z',
      previousPromotionDigest: null,
    });
    expectFailure(noReport, 'promotion-gate-rejected');

    const failedReport = promoteCandidate({
      candidate,
      targetState: 'sandboxed',
      evidenceDigest: contentDigest({}),
      sandboxReport: { passed: false, isolationLevel: 'vm', findings: ['escape'] },
      at: '2026-10-06T09:00:00.000Z',
      previousPromotionDigest: null,
    });
    expectFailure(failedReport, 'promotion-gate-rejected');

    const noIsolation = promoteCandidate({
      candidate,
      targetState: 'sandboxed',
      evidenceDigest: contentDigest({}),
      sandboxReport: { passed: true, isolationLevel: 'none', findings: [] },
      at: '2026-10-06T09:00:00.000Z',
      previousPromotionDigest: null,
    });
    expectFailure(noIsolation, 'promotion-gate-rejected');
  });

  it('rejects evaluation promotion without fully-passing measured evidence', () => {
    let candidate = ingestedCandidate();
    const ingested = promoteCandidate({
      candidate,
      targetState: 'ingested',
      evidenceDigest: contentDigest({}),
      at: '2026-10-06T09:00:00.000Z',
      previousPromotionDigest: null,
    });
    if (!ingested.ok) throw new Error(ingested.error.message);
    candidate = ingested.value.promoted;

    const sandboxed = promoteCandidate({
      candidate,
      targetState: 'sandboxed',
      evidenceDigest: contentDigest({}),
      sandboxReport: PASSING_SANDBOX,
      at: '2026-10-06T09:01:00.000Z',
      previousPromotionDigest: ingested.value.record.recordDigest,
    });
    if (!sandboxed.ok) throw new Error(sandboxed.error.message);
    candidate = sandboxed.value.promoted;

    const profiled = promoteCandidate({
      candidate,
      targetState: 'profiled',
      evidenceDigest: contentDigest({}),
      at: '2026-10-06T09:02:00.000Z',
      previousPromotionDigest: sandboxed.value.record.recordDigest,
    });
    if (!profiled.ok) throw new Error(profiled.error.message);
    candidate = profiled.value.promoted;

    // No evidence:
    const noEvidence = promoteCandidate({
      candidate,
      targetState: 'evaluated',
      evidenceDigest: contentDigest({}),
      at: '2026-10-06T09:03:00.000Z',
      previousPromotionDigest: profiled.value.record.recordDigest,
    });
    expectFailure(noEvidence, 'promotion-gate-rejected');

    // Failing evidence:
    const failingEvidence = promoteCandidate({
      candidate,
      targetState: 'evaluated',
      evidenceDigest: contentDigest({}),
      evaluationEvidence: [{ ...PASSING_EVIDENCE[0]!, passed: false }],
      at: '2026-10-06T09:03:00.000Z',
      previousPromotionDigest: profiled.value.record.recordDigest,
    });
    expectFailure(failingEvidence, 'promotion-gate-rejected');
  });

  it('walks the full gate honestly: discovered -> ... -> verified with a hash-chained record set', () => {
    let candidate = ingestedCandidate();
    const records: PromotionRecord[] = [];
    const steps = [
      { target: 'ingested' as const, at: '2026-10-06T09:00:00.000Z' },
      { target: 'sandboxed' as const, at: '2026-10-06T09:01:00.000Z', sandbox: PASSING_SANDBOX },
      { target: 'profiled' as const, at: '2026-10-06T09:02:00.000Z' },
      { target: 'evaluated' as const, at: '2026-10-06T09:03:00.000Z', evidence: PASSING_EVIDENCE },
      { target: 'verified' as const, at: '2026-10-06T09:04:00.000Z', approval: POLICY_APPROVAL },
    ];
    let previous: string | null = null;
    for (const step of steps) {
      const outcome = promoteCandidate({
        candidate,
        targetState: step.target,
        evidenceDigest: contentDigest({ step: step.target }),
        sandboxReport: step.sandbox,
        evaluationEvidence: step.evidence,
        policyApproval: step.approval,
        at: step.at,
        previousPromotionDigest: previous,
      });
      if (!outcome.ok) throw new Error(outcome.error.message);
      candidate = outcome.value.promoted;
      records.push(outcome.value.record);
      previous = outcome.value.record.recordDigest;
    }

    // The verified candidate is NOW consequential-eligible and inside
    // the Epoch trust domain.
    expect(candidate.evaluationState).toBe('verified');
    expect(candidate.security.trustDomain).toBe('epoch-verified');
    expect(isConsequentialEligible(candidate)).toBe(true);

    // The promotion chain verifies (hash-linked, content-addressed).
    expect(verifyPromotionChain(records).ok).toBe(true);

    // A tampered record is detected.
    const tampered = records.map((record, index) =>
      index === 2 ? { ...record, note: 'tampered' } : record,
    );
    expect(verifyPromotionChain(tampered).ok).toBe(false);
  });

  it('verified promotion without a policy approval is rejected (security outside model prompts)', () => {
    let candidate = ingestedCandidate();
    const walk = [
      { target: 'ingested' as const, sandbox: undefined, evidence: undefined },
      { target: 'sandboxed' as const, sandbox: PASSING_SANDBOX, evidence: undefined },
      { target: 'profiled' as const, sandbox: undefined, evidence: undefined },
      { target: 'evaluated' as const, sandbox: undefined, evidence: PASSING_EVIDENCE },
    ];
    let previous: string | null = null;
    for (const step of walk) {
      const outcome = promoteCandidate({
        candidate,
        targetState: step.target,
        evidenceDigest: contentDigest({ step: step.target }),
        sandboxReport: step.sandbox,
        evaluationEvidence: step.evidence,
        at: '2026-10-06T09:00:00.000Z',
        previousPromotionDigest: previous,
      });
      if (!outcome.ok) throw new Error(outcome.error.message);
      candidate = outcome.value.promoted;
      previous = outcome.value.record.recordDigest;
    }
    const noApproval = promoteCandidate({
      candidate,
      targetState: 'verified',
      evidenceDigest: contentDigest({}),
      at: '2026-10-06T09:05:00.000Z',
      previousPromotionDigest: previous,
    });
    expect(noApproval.ok).toBe(false);
    if (noApproval.ok) throw new Error('expected failure');
    expect(noApproval.error.message).toContain('human policy approval');
    expectFailure(noApproval, 'promotion-gate-rejected');
  });
});
