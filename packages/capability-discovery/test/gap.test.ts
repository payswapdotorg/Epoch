// Acceptance 5: a missing capability becomes an explicit CapabilityGap
// with the full ARCD1.0 lifecycle; the transition chain is append-only,
// hash-linked and tamper-detecting.
import { describe, expect, it } from 'vitest';
import {
  createCapabilityGap,
  gapTransitionDigestOf,
  transitionCapabilityGap,
  verifyGapChain,
} from '../src/gap';
import { runEcosystemDiscovery } from '../src/ecosystem';
import { StaticCatalogSourceAdapter } from '../src/adapters';
import type { CapabilityGap } from '../src/types';
import { TENANT_A, op, sourceArtifact } from './fixtures';

function sampleGap(): CapabilityGap {
  return createCapabilityGap({
    tenantId: TENANT_A,
    operation: op('software.security-audit'),
    demandSummary: 'Security audit of the new surface',
    lifecycleStage: 'realize',
    triggeringSignalIds: ['t-security'],
    at: '2026-10-05T09:00:00.000Z',
  });
}

describe('acceptance 5 — the capability-gap lifecycle', () => {
  it('creates a gap in UNSATISFIED with a genesis transition', () => {
    const gap = sampleGap();
    expect(gap.state).toBe('UNSATISFIED');
    expect(gap.gapId).toMatch(/^gap:[0-9a-f]{16}$/);
    expect(gap.transitions).toHaveLength(1);
    expect(gap.transitions[0]!.toState).toBe('UNSATISFIED');
    expect(gap.transitions[0]!.previousTransitionDigest).toBeNull();
    expect(verifyGapChain(gap).ok).toBe(true);
  });

  it('walks the full lifecycle with typed transition conflicts', () => {
    let gap = sampleGap();
    // UNSATISFIED -> CANDIDATE_FOUND (ecosystem scan found a candidate).
    const found = transitionCapabilityGap(gap, {
      toState: 'CANDIDATE_FOUND',
      at: '2026-10-06T09:00:00.000Z',
      cause: 'ecosystem scan found 1 candidate',
      evidenceDigest: 'f'.repeat(64),
    });
    if (!found.ok) throw new Error(found.error.message);
    gap = found.value;
    expect(gap.state).toBe('CANDIDATE_FOUND');
    expect(gap.transitions).toHaveLength(2);

    // CANDIDATE_FOUND -> EVALUATED (evidence exists, policy not yet met).
    const evaluated = transitionCapabilityGap(gap, {
      toState: 'EVALUATED',
      at: '2026-10-07T09:00:00.000Z',
      cause: 'sandbox evaluation completed',
      evidenceDigest: 'e'.repeat(64),
    });
    if (!evaluated.ok) throw new Error(evaluated.error.message);
    gap = evaluated.value;

    // EVALUATED -> VERIFIED (policy approval).
    const verified = transitionCapabilityGap(gap, {
      toState: 'VERIFIED',
      at: '2026-10-08T09:00:00.000Z',
      cause: 'policy approval recorded',
      evidenceDigest: 'd'.repeat(64),
    });
    if (!verified.ok) throw new Error(verified.error.message);
    gap = verified.value;
    expect(gap.state).toBe('VERIFIED');
    expect(gap.transitions).toHaveLength(4);
    expect(verifyGapChain(gap).ok).toBe(true);

    // Illegal transition (VERIFIED -> EVALUATED) is a typed conflict.
    const illegal = transitionCapabilityGap(gap, {
      toState: 'EVALUATED',
      at: '2026-10-09T09:00:00.000Z',
      cause: 'not allowed',
    });
    expect(illegal.ok).toBe(false);
    if (!illegal.ok) expect(illegal.error.code).toBe('gap-transition-conflict');

    // The illegal jump UNSATISFIED -> VERIFIED is rejected from scratch.
    const jump = transitionCapabilityGap(sampleGap(), {
      toState: 'VERIFIED',
      at: '2026-10-09T09:00:00.000Z',
      cause: 'skip the gates',
    });
    expect(jump.ok).toBe(false);
  });

  it('detects tampered transition digests and broken chains', () => {
    const gap = sampleGap();
    const found = transitionCapabilityGap(gap, {
      toState: 'CANDIDATE_FOUND',
      at: '2026-10-06T09:00:00.000Z',
      cause: 'scan',
    });
    if (!found.ok) return;
    const tampered = {
      ...found.value,
      transitions: [
        found.value.transitions[0]!,
        { ...found.value.transitions[1]!, cause: 'tampered cause' },
      ],
    };
    const verification = verifyGapChain(tampered);
    expect(verification.ok).toBe(false);
    if (!verification.ok) expect(verification.error.code).toBe('gap-transition-conflict');

    const broken = {
      ...found.value,
      transitions: [
        { ...found.value.transitions[0]!, previousTransitionDigest: '0'.repeat(64) },
        found.value.transitions[1]!,
      ],
    };
    expect(verifyGapChain(broken).ok).toBe(false);
  });

  it('an UNSATISFIED gap triggers ecosystem discovery and transitions on candidates found', () => {
    const gap = sampleGap();
    const adapter = new StaticCatalogSourceAdapter({
      adapterId: 'fixture-catalog',
      description: 'static fixture catalog',
      catalog: [
        sourceArtifact({
          artifactId: 'audit-artifact',
          summary: 'Claims security audit capability',
          claims: [
            {
              operation: op('software.security-audit'),
              inputKinds: ['code'],
              outputKinds: ['document'],
            },
          ],
        }),
      ],
    });
    const outcome = runEcosystemDiscovery({
      tenantId: TENANT_A,
      trigger: 'gap',
      gaps: [gap],
      adapters: [adapter],
      existingCandidates: [],
      at: '2026-10-06T09:00:00.000Z',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // The external candidate was ingested at the safe boundary...
    expect(outcome.value.ingestedCandidates).toHaveLength(1);
    const candidate = outcome.value.ingestedCandidates[0]!;
    expect(candidate.evaluationState).toBe('discovered');
    expect(candidate.security.sandboxRequired).toBe(true);
    expect(candidate.security.trustDomain).toBe('external');
    // ...and the gap transitioned CANDIDATE_FOUND with a hash-linked chain.
    expect(outcome.value.updatedGaps).toHaveLength(1);
    const updated = outcome.value.updatedGaps[0]!;
    expect(updated.state).toBe('CANDIDATE_FOUND');
    expect(updated.transitions).toHaveLength(2);
    expect(updated.transitions[1]!.previousTransitionDigest).toBe(
      gap.transitions[0]!.transitionDigest,
    );
    expect(gapTransitionDigestOf(updated.transitions[1]!)).toBe(
      updated.transitions[1]!.transitionDigest,
    );
    // The ecosystem run has a verifiable 4-stage lineage.
    expect(outcome.value.run.runKind).toBe('ecosystem');
    expect(outcome.value.run.stages.map((stage) => stage.stage)).toEqual([
      'inputs',
      'candidates',
      'gap-updates',
      'promotions',
    ]);
  });
});
