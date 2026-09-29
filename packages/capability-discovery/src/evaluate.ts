/**
 * Organization evaluation under DECLARED criteria (ARCD1.0 step 8,
 * acceptance 4).
 *
 * Candidate organizations are evaluated as ORGANIZATIONS against the
 * task's declared objective/constraint/evidence criteria — a fixed set of
 * deterministic neutral metrics (coverage, evidence, redundancy,
 * estimates, gaps, single-point-of-failure risk), never as a bag of model
 * scores. Hard constraints eliminate; objectives score (min-max
 * normalized across the candidate pool); the evaluation records values,
 * admissibility, rejection reasons and the deterministic score so the
 * decision is reproducible (acceptance 8).
 */
import type {
  CapabilityDemand,
  CapabilityGapId,
  CriterionResult,
  EvaluationCriterion,
  OrganizationEvaluation,
  OrganizationProposal,
  OrganizationSelection,
  RoleProposal,
  RoleResolution,
} from './types';
import { contentDigest } from './canonical';

/** Evaluation output. */
export interface EvaluationOutcome {
  readonly evaluations: readonly OrganizationEvaluation[];
  readonly selection: OrganizationSelection;
  /** Digest over the canonically-ordered evaluations + selection (lineage). */
  readonly evaluationDigest: string;
  readonly selectionDigest: string;
}

/** Metric inputs per organization (computed once, deterministically). */
export interface OrganizationMetrics {
  readonly demandCoverage: number;
  readonly unmetDemandCount: number;
  readonly evidenceCoverage: number;
  readonly redundancyCoverage: number;
  readonly estimatedLatency: number | null;
  readonly estimatedCost: number | null;
  readonly gapCount: number;
  readonly criticalSinglePointCount: number;
}

/** Compute the neutral metric set for one organization. */
export function computeOrganizationMetrics(
  organization: OrganizationProposal,
  roles: readonly RoleProposal[],
  demands: readonly CapabilityDemand[],
  matchIndex: ReadonlyMap<string, CandidateMatchOutcome>,
  openGapIds: readonly CapabilityGapId[] = [],
): OrganizationMetrics {
  const roleById = new Map(roles.map((role) => [role.roleProposalId, role]));
  const demandById = new Map(demands.map((demand) => [demand.demandId, demand]));

  let satisfiedWeight = 0;
  let unmetCount = 0;
  let evidenceRelevant = 0;
  let evidenceSatisfied = 0;
  let boundRoles = 0;
  let backedRoles = 0;
  let criticalSinglePoints = 0;
  const gapIds = new Set<string>(openGapIds);

  for (const binding of organization.roleBindings) {
    boundRoles += 1;
    if (binding.backupCandidateIds.length > 0) backedRoles += 1;
    for (const gapId of binding.carriedGapIds) gapIds.add(gapId);
    const role = roleById.get(binding.roleProposalId);
    if (role === undefined) continue;
    const isCritical =
      role.authorityBoundary.requiresHumanCosign ||
      role.satisfiesDemands.some((demandId) => demandById.get(demandId)?.verificationRequired === true);
    if (isCritical && binding.backupCandidateIds.length === 0) criticalSinglePoints += 1;

    for (const demandId of role.satisfiesDemands) {
      const demand = demandById.get(demandId);
      if (demand === undefined) continue;
      const primaryOutcome = matchIndex.get(`${demandId}|${binding.primaryCandidateId}`);
      const backupOutcomes = binding.backupCandidateIds.map((backupId) =>
        matchIndex.get(`${demandId}|${backupId}`),
      );
      const best =
        primaryOutcome === 'satisfied'
          ? 'satisfied'
          : backupOutcomes.includes('satisfied')
            ? 'satisfied'
            : primaryOutcome === 'claimed' || backupOutcomes.includes('claimed')
              ? 'claimed'
              : 'incompatible';
      if (best === 'satisfied') satisfiedWeight += 1;
      else if (best === 'claimed') satisfiedWeight += 0.5;
      else unmetCount += 1;
      if (demand.verificationRequired) {
        evidenceRelevant += 1;
        if (best === 'satisfied') evidenceSatisfied += 1;
      }
    }
  }

  const totalDemands = Math.max(demands.length, 1);
  return {
    demandCoverage: Math.round((satisfiedWeight / totalDemands) * 1000) / 1000,
    unmetDemandCount: unmetCount,
    evidenceCoverage:
      evidenceRelevant === 0 ? 1 : Math.round((evidenceSatisfied / evidenceRelevant) * 1000) / 1000,
    redundancyCoverage:
      boundRoles === 0 ? 0 : Math.round((backedRoles / boundRoles) * 1000) / 1000,
    estimatedLatency: organization.estimates.estimatedLatencyMs,
    estimatedCost:
      organization.estimates.estimatedCost === null
        ? null
        : Number(organization.estimates.estimatedCost.amount),
    gapCount: gapIds.size,
    criticalSinglePointCount: criticalSinglePoints,
  };
}

/** Outcome alias (kept narrow to avoid importing the full match record). */
export type CandidateMatchOutcome = 'satisfied' | 'claimed' | 'incompatible';

function metricValue(metrics: OrganizationMetrics, metric: string): number | null {
  switch (metric) {
    case 'demand-coverage':
      return metrics.demandCoverage;
    case 'unmet-demand-count':
      return metrics.unmetDemandCount;
    case 'evidence-coverage':
      return metrics.evidenceCoverage;
    case 'redundancy-coverage':
      return metrics.redundancyCoverage;
    case 'estimated-latency':
      return metrics.estimatedLatency;
    case 'estimated-cost':
      return metrics.estimatedCost;
    case 'gap-count':
      return metrics.gapCount;
    case 'critical-single-point-count':
      return metrics.criticalSinglePointCount;
    default:
      return null;
  }
}

/**
 * Evaluate every organization under the declared criteria and select (or
 * stage) the best admissible one.
 */
export function evaluateOrganizations(
  organizations: readonly OrganizationProposal[],
  roles: readonly RoleProposal[],
  demands: readonly CapabilityDemand[],
  criteria: readonly EvaluationCriterion[],
  matchIndex: ReadonlyMap<string, CandidateMatchOutcome>,
  resolutions: readonly RoleResolution[] = [],
): EvaluationOutcome {
  // All open gaps of the run (constant across organizations: the missing
  // capability does not depend on which organization is chosen).
  const openGapIds = [
    ...new Set(resolutions.flatMap((resolution) => resolution.gapIds)),
  ].sort();
  const metricsByOrg = new Map(
    organizations.map((organization) => [
      organization.organizationId,
      computeOrganizationMetrics(organization, roles, demands, matchIndex, openGapIds),
    ]),
  );

  const evaluations = [...organizations]
    .sort((a, b) => (a.organizationId < b.organizationId ? -1 : 1))
    .map((organization) => {
      const metrics = metricsByOrg.get(organization.organizationId)!;
      const rejectionReasons: string[] = [];
      const criterionResults: CriterionResult[] = [];
      for (const criterion of [...criteria].sort((a, b) =>
        a.criterionId < b.criterionId ? -1 : 1,
      )) {
        const value = metricValue(metrics, criterion.metric);
        const isGate = criterion.kind === 'hard-constraint' || criterion.kind === 'evidence-coverage';
        let thresholdMet: boolean | null = null;
        if (isGate && criterion.threshold !== undefined) {
          if (value === null) {
            thresholdMet = null; // undeclared: gate not evaluable
            rejectionReasons.push(
              `criterion ${criterion.criterionId} (${criterion.metric}) is undeclared for this organization`,
            );
          } else {
            thresholdMet =
              criterion.direction === 'minimize'
                ? value <= criterion.threshold
                : value >= criterion.threshold;
            if (!thresholdMet) {
              rejectionReasons.push(
                `criterion ${criterion.criterionId} (${criterion.metric}=${value}) failed threshold ${criterion.threshold} (${criterion.direction})`,
              );
            }
          }
        }
        criterionResults.push({
          criterionId: criterion.criterionId,
          metric: criterion.metric,
          value,
          thresholdMet,
        });
      }

      // Objective score: min-max normalized across the pool.
      const objectives = criteria
        .filter((criterion) => criterion.kind === 'objective')
        .sort((a, b) => (a.criterionId < b.criterionId ? -1 : 1));
      let score: number | null = null;
      if (objectives.length > 0) {
        let weighted = 0;
        for (const objective of objectives) {
          const own = metricValue(metrics, objective.metric);
          const all = [...metricsByOrg.values()]
            .map((candidate) => metricValue(candidate, objective.metric))
            .filter((value): value is number => value !== null);
          if (own === null || all.length === 0) {
            weighted += (objective.weight ?? 0) * 0.5; // neutral for undeclared
            continue;
          }
          const min = Math.min(...all);
          const max = Math.max(...all);
          const normalized =
            max === min
              ? 0.5
              : objective.direction === 'minimize'
                ? (max - own) / (max - min)
                : (own - min) / (max - min);
          weighted += (objective.weight ?? 0) * normalized;
        }
        score = Math.round(weighted * 1000) / 1000;
      }

      return {
        organizationId: organization.organizationId,
        criterionResults,
        admissible: rejectionReasons.length === 0,
        rejectionReasons: rejectionReasons.sort(),
        score,
      } satisfies OrganizationEvaluation;
    });

  // Selection: best admissible non-staged organization (score desc, id
  // asc); staged admissible organizations are surfaced separately.
  const admissible = evaluations
    .filter((evaluation) => evaluation.admissible)
    .sort((a, b) => {
      const scoreA = a.score ?? Number.NEGATIVE_INFINITY;
      const scoreB = b.score ?? Number.NEGATIVE_INFINITY;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.organizationId < b.organizationId ? -1 : 1;
    });
  const stagedIds = new Set(
    organizations.filter((organization) => organization.staged).map((org) => org.organizationId),
  );
  const selectable = admissible.filter((evaluation) => !stagedIds.has(evaluation.organizationId));
  const stagedAdmissible = admissible.filter((evaluation) =>
    stagedIds.has(evaluation.organizationId),
  );
  const selected = selectable[0] ?? null;
  const selection: OrganizationSelection = {
    selectedOrganizationId: selected?.organizationId ?? null,
    stagedOrganizationIds: stagedAdmissible
      .map((evaluation) => evaluation.organizationId)
      .sort(),
    rejected: evaluations
      .filter((evaluation) => !evaluation.admissible)
      .map((evaluation) => ({
        organizationId: evaluation.organizationId,
        reasons: evaluation.rejectionReasons,
      }))
      .sort((a, b) => (a.organizationId < b.organizationId ? -1 : 1)),
    rationale: selected
      ? `selected ${selected.organizationId} (score ${selected.score ?? 'n/a'}); ${stagedAdmissible.length} staged alternative(s), ${evaluations.length - admissible.length} inadmissible`
      : stagedAdmissible.length > 0
        ? 'all admissible organizations are staged (unverified primary candidates); no consequential selection'
        : 'no admissible organization',
  };

  const evaluationDigest = contentDigest(evaluations);
  const selectionDigest = contentDigest(selection);
  return { evaluations, selection, evaluationDigest, selectionDigest };
}
