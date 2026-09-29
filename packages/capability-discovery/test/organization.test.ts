// Acceptance 4: candidate organizations can be evaluated using declared
// objective/constraint/evidence criteria; acceptance 6 (staging) is
// exercised through composition here and pinned further in
// candidates.test.ts.
import { describe, expect, it } from 'vitest';
import { compileCapabilityDemands } from '../src/compile';
import { synthesizeRoleProposals } from '../src/roles';
import { resolveCandidates } from '../src/resolve';
import { composeOrganizations, isConsequentialEligible } from '../src/organization';
import { promoteCandidate } from '../src/candidates';
import { contentDigest } from '../src/canonical';
import { computeOrganizationMetrics } from '../src/evaluate';
import { runProblemDrivenDiscovery } from '../src/run';
import type { EvaluationCriterion } from '../src/types';
import {
  constructionCandidates,
  constructionInput,
  declaredCriteria,
  softwareCandidates,
  softwareInput,
} from './fixtures';

describe('acceptance 4 — organization composition + declared-criteria evaluation', () => {
  it('composes organizations with primaries, backups, handoffs and supervision', () => {
    const input = constructionInput();
    const compilation = compileCapabilityDemands(input);
    if (!compilation.ok) return;
    const synthesis = synthesizeRoleProposals(
      input,
      compilation.value.demandSet,
      compilation.value.templateOverrideRejections,
    );
    const resolution = resolveCandidates(
      input,
      synthesis.roleProposals,
      compilation.value.demandSet.demands,
      { profiles: Object.values(constructionCandidates()) },
      { runId: 'discrun:0123456789abcdef', at: '2026-10-05T09:00:00.000Z' },
    );
    const composition = composeOrganizations(
      synthesis.roleProposals,
      resolution.resolutions,
      compilation.value.demandSet.demands,
      Object.values(constructionCandidates()),
      {},
    );
    expect(composition.organizations.length).toBeGreaterThanOrEqual(1);
    const organization = composition.organizations[0]!;
    expect(organization.staged).toBe(false);
    expect(organization.roleBindings.length).toBeGreaterThan(0);
    // Every binding's primary is consequential-eligible (verified + in
    // the Epoch trust domain).
    const candidatesById = new Map(
      Object.values(constructionCandidates()).map((candidate) => [candidate.candidateId, candidate]),
    );
    for (const binding of organization.roleBindings) {
      const primary = candidatesById.get(binding.primaryCandidateId)!;
      expect(isConsequentialEligible(primary)).toBe(true);
    }
    // Cosign-bearing roles carry a human-review supervision edge.
    const cosignRole = organization.supervision.find((edge) => edge.escalation === 'human-review');
    expect(cosignRole).toBeDefined();
    // Organization id is content-addressed.
    expect(organization.organizationId).toMatch(/^org:[0-9a-f]{16}$/);
  });

  it('evaluates organizations under declared criteria and records admissibility + scores', () => {
    const result = runProblemDrivenDiscovery(constructionInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria: declaredCriteria(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { organizations, evaluations, selection } = result.value;
    expect(organizations.length).toBeGreaterThan(0);
    expect(evaluations.length).toBe(organizations.length);

    for (const evaluation of evaluations) {
      const criterionIds = evaluation.criterionResults.map((entry) => entry.criterionId);
      expect(criterionIds).toEqual(['cov', 'cov-obj', 'ev-obj']);
    }
    // The construction scenario satisfies the 0.4 coverage threshold, so
    // at least one organization is admissible and selectable.
    const admissible = evaluations.filter((evaluation) => evaluation.admissible);
    expect(admissible.length).toBeGreaterThan(0);
    expect(selection!.selectedOrganizationId).not.toBeNull();
    expect(selection!.stagedOrganizationIds).toEqual([]);

    // The selected organization is the best-scoring admissible one.
    const selected = evaluations.find(
      (evaluation) => evaluation.organizationId === selection!.selectedOrganizationId,
    )!;
    for (const evaluation of admissible) {
      expect(evaluation.score ?? -1).toBeLessThanOrEqual(selected.score ?? -1);
    }
  });

  it('hard-constraint violations reject organizations with recorded reasons', () => {
    const impossible: readonly EvaluationCriterion[] = [
      {
        criterionId: 'impossible',
        kind: 'hard-constraint',
        metric: 'demand-coverage',
        direction: 'maximize',
        threshold: 2, // unreachable (coverage is <= 1)
      },
    ];
    const result = runProblemDrivenDiscovery(constructionInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria: impossible,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const evaluation of result.value.evaluations) {
      expect(evaluation.admissible).toBe(false);
      expect(evaluation.rejectionReasons.some((reason) => reason.includes('impossible'))).toBe(true);
    }
    expect(result.value.selection!.selectedOrganizationId).toBeNull();
    expect(result.value.selection!.rejected.length).toBe(result.value.organizations.length);
  });

  it('evidence-coverage criteria gate verification-required demands', () => {
    const criteria: readonly EvaluationCriterion[] = [
      {
        criterionId: 'evidence-gate',
        kind: 'evidence-coverage',
        metric: 'evidence-coverage',
        direction: 'maximize',
        threshold: 0.99, // the construction scenario cannot fully satisfy this
      },
    ];
    const result = runProblemDrivenDiscovery(constructionInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The verification demand is unmet in this scenario, so evidence
    // coverage is below the gate -> every organization is inadmissible.
    expect(result.value.evaluations.every((evaluation) => !evaluation.admissible)).toBe(true);
  });

  it('metrics are deterministic functions of bindings and matches', () => {
    const input = constructionInput();
    const compilation = compileCapabilityDemands(input);
    if (!compilation.ok) return;
    const synthesis = synthesizeRoleProposals(
      input,
      compilation.value.demandSet,
      compilation.value.templateOverrideRejections,
    );
    const pool = Object.values(constructionCandidates());
    const resolution = resolveCandidates(
      input,
      synthesis.roleProposals,
      compilation.value.demandSet.demands,
      { profiles: pool },
      { runId: 'discrun:0123456789abcdef', at: '2026-10-05T09:00:00.000Z' },
    );
    const composition = composeOrganizations(
      synthesis.roleProposals,
      resolution.resolutions,
      compilation.value.demandSet.demands,
      pool,
      {},
    );
    const organization = composition.organizations[0]!;
    const openGapIds = [
      ...new Set(resolution.resolutions.flatMap((entry) => entry.gapIds)),
    ].sort();
    const metrics = computeOrganizationMetrics(
      organization,
      synthesis.roleProposals,
      compilation.value.demandSet.demands,
      resolution.matchIndex,
      openGapIds,
    );
    const metricsAgain = computeOrganizationMetrics(
      organization,
      synthesis.roleProposals,
      compilation.value.demandSet.demands,
      resolution.matchIndex,
      openGapIds,
    );
    expect(metrics).toEqual(metricsAgain);
    expect(metrics.demandCoverage).toBeGreaterThan(0);
    expect(metrics.demandCoverage).toBeLessThanOrEqual(1);
    expect(metrics.gapCount).toBeGreaterThan(0); // the unknown-resolution gap
  });

  it('software scenario: unverified external candidate stages the organization (acceptance 6)', () => {
    const { reviewAgent, externalTestCandidate } = softwareCandidates();

    // Phase 1: the external candidate is 'discovered' — below the
    // promotion gates it cannot enter ANY organization.
    // Permissive coverage gate for this scenario (the security-audit and
    // artifact demands stay unmet by design; staging is the subject).
    const stagingCriteria: readonly EvaluationCriterion[] = [
      {
        criterionId: 'cov',
        kind: 'hard-constraint',
        metric: 'demand-coverage',
        direction: 'maximize',
        threshold: 0.1,
      },
      {
        criterionId: 'cov-obj',
        kind: 'objective',
        metric: 'demand-coverage',
        direction: 'maximize',
        weight: 1,
      },
    ];
    const phase1 = runProblemDrivenDiscovery(softwareInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: [reviewAgent, externalTestCandidate],
      criteria: stagingCriteria,
    });
    if (!phase1.ok) throw new Error(phase1.error.message);
    for (const organization of phase1.value.organizations) {
      for (const binding of organization.roleBindings) {
        expect(binding.primaryCandidateId).not.toBe(externalTestCandidate.candidateId);
        expect(binding.backupCandidateIds).not.toContain(externalTestCandidate.candidateId);
      }
    }

    // Phase 2: walk the gate honestly to 'evaluated' (sandbox + measured
    // evidence; policy approval deliberately NOT yet granted).
    let candidate = externalTestCandidate;
    let previous: string | null = null;
    const gateSteps: ReadonlyArray<{
      readonly target: 'ingested' | 'sandboxed' | 'profiled' | 'evaluated';
      readonly sandbox?: { passed: boolean; isolationLevel: 'vm'; findings: string[] };
      readonly evidence?: readonly {
        operation: { id: string; versionConstraint: string };
        metric: string;
        value: number;
        unit: string;
        passed: boolean;
        evidenceDigest: string;
      }[];
    }> = [
      { target: 'ingested' },
      { target: 'sandboxed', sandbox: { passed: true, isolationLevel: 'vm', findings: [] } },
      { target: 'profiled' },
      {
        target: 'evaluated',
        evidence: [
          {
            operation: { id: 'software.test-generation', versionConstraint: '*' },
            metric: 'pass-rate',
            value: 0.93,
            unit: 'ratio',
            passed: true,
            evidenceDigest: 'f'.repeat(64),
          },
        ],
      },
    ];
    for (const step of gateSteps) {
      const outcome = promoteCandidate({
        candidate,
        targetState: step.target,
        evidenceDigest: contentDigest({ step: step.target }),
        sandboxReport: step.sandbox,
        evaluationEvidence: step.evidence,
        at: '2026-10-05T10:00:00.000Z',
        previousPromotionDigest: previous,
      });
      if (!outcome.ok) throw new Error(outcome.error.message);
      candidate = outcome.value.promoted;
      previous = outcome.value.record.recordDigest;
    }
    expect(candidate.evaluationState).toBe('evaluated');

    // Phase 3: re-run discovery — the evaluated external candidate now
    // STAGES an alternative organization, and a staged organization is
    // never selected.
    const phase3 = runProblemDrivenDiscovery(softwareInput(), {
      at: '2026-10-05T11:00:00.000Z',
      candidates: [reviewAgent, candidate],
      criteria: stagingCriteria,
    });
    if (!phase3.ok) throw new Error(phase3.error.message);
    const { organizations, selection, evaluations } = phase3.value;
    expect(organizations.length).toBeGreaterThan(0);
    const staged = organizations.filter((organization) => organization.staged);
    expect(staged.length).toBeGreaterThan(0);
    for (const organization of staged) {
      expect(organization.stagingReasons.length).toBeGreaterThan(0);
      expect(organization.stagingReasons[0]).toContain('not verified');
    }
    const selectedId = selection!.selectedOrganizationId;
    expect(selectedId).not.toBeNull();
    expect(staged.map((organization) => organization.organizationId)).not.toContain(selectedId);
    expect(evaluations.some((evaluation) => evaluation.score !== null)).toBe(true);
  });
});
