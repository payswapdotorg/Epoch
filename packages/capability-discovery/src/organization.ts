/**
 * Candidate-organization composition (ARCD1.0 step 7).
 *
 * Composes {@link OrganizationProposal} records from role resolutions and
 * the candidate pool: primary bindings, backups (redundancy), handoff
 * topology derived from capability dependency edges, supervision edges
 * derived from authority/verification demands, and deterministic
 * rollup estimates.
 *
 * The consequential-eligibility gate (acceptance 6): a primary binding
 * must be a VERIFIED candidate inside the Epoch trust domain. Verified
 * external candidates reach that state ONLY through the promotion gate
 * (sandbox -> profile -> evaluation -> policy approval). An organization
 * whose best available candidate is below `verified` is composed as
 * STAGED — evaluable, never selectable. Candidates below `evaluated`
 * cannot enter an organization at all (typed rejection).
 */
import type {
  CandidateId,
  CandidateProfile,
  CapabilityDemand,
  CapabilityGapId,
  HandoffEdge,
  MoneyAmount,
  OrganizationProposal,
  OrganizationRoleBinding,
  RoleProposal,
  RoleResolution,
  SupervisionEdge,
} from './types';
import { contentDigest, digestSuffix16, operationKey, sumDecimalAmounts } from './canonical';
import { CAPABILITY_DISCOVERY_RECORD_VERSION } from './version';

/** Consequential eligibility: verified AND inside the Epoch trust domain. */
export function isConsequentialEligible(candidate: CandidateProfile): boolean {
  return (
    candidate.evaluationState === 'verified' && candidate.security.trustDomain === 'epoch-verified'
  );
}

/** One role's ranked candidate plan inside composition. */
interface RolePlan {
  readonly role: RoleProposal;
  readonly eligible: readonly CandidateId[];
  readonly stageable: readonly CandidateId[];
  readonly carriedGapIds: readonly CapabilityGapId[];
}

/** One role's chosen binding inside a candidate organization. */
interface BindingChoice {
  readonly planIndex: number;
  readonly primary: CandidateId;
  readonly backups: readonly CandidateId[];
  readonly staged: boolean;
  readonly stagingReasons: readonly string[];
}

/** Staging eligibility: evaluated (or better) candidates may be staged. */
export function isStageable(candidate: CandidateProfile): boolean {
  const rank = ['discovered', 'ingested', 'sandboxed', 'profiled', 'evaluated', 'verified'];
  return rank.indexOf(candidate.evaluationState) >= rank.indexOf('evaluated');
}

/** Composition options. */
export interface OrganizationCompositionOptions {
  /** Maximum number of alternative organizations to enumerate (default 4). */
  readonly maxOrganizations?: number;
}

/** Composition output. */
export interface OrganizationComposition {
  readonly organizations: readonly OrganizationProposal[];
  /** Digest over the canonically-ordered organization set (lineage). */
  readonly organizationSetDigest: string;
}

/**
 * Compose candidate organizations. Deterministic: candidates, roles and
 * alternatives are canonically ordered; variant enumeration is a pure
 * function of the (role, alternative) index pairs.
 */
export function composeOrganizations(
  roles: readonly RoleProposal[],
  resolutions: readonly RoleResolution[],
  demands: readonly CapabilityDemand[],
  candidates: readonly CandidateProfile[],
  options: OrganizationCompositionOptions = {},
): OrganizationComposition {
  const maxOrganizations = options.maxOrganizations ?? 4;
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const demandById = new Map(demands.map((demand) => [demand.demandId, demand]));
  const resolutionByRole = new Map(
    resolutions.map((resolution) => [resolution.roleProposalId, resolution]),
  );
  const roleById = new Map(roles.map((role) => [role.roleProposalId, role]));

  // Per-role ranked candidate lists (eligible first, then stageable).
  const plans: RolePlan[] = [];
  for (const role of [...roles].sort((a, b) =>
    a.roleProposalId < b.roleProposalId ? -1 : 1,
  )) {
    const resolution = resolutionByRole.get(role.roleProposalId);
    if (resolution === undefined) continue;
    const ranked = resolution.assignments.map((assignment) => assignment.candidateId);
    const eligible: CandidateId[] = [];
    const stageable: CandidateId[] = [];
    for (const candidateId of ranked) {
      const candidate = candidateById.get(candidateId);
      if (candidate === undefined) continue;
      if (candidate.evaluationState === 'deprecated' || candidate.evaluationState === 'retired') {
        continue;
      }
      if (!isStageable(candidate)) continue; // below evaluated: never enters an org
      if (isConsequentialEligible(candidate)) eligible.push(candidateId);
      else stageable.push(candidateId);
    }
    if (eligible.length + stageable.length === 0) continue; // unresolvable role: carried as gaps
    plans.push({
      role,
      eligible,
      stageable,
      carriedGapIds: resolution.gapIds,
    });
  }

  if (plans.length === 0) {
    return { organizations: [], organizationSetDigest: contentDigest([]) };
  }

  // Base binding plan: primary = best eligible, else best stageable
  // (staged organization); backup = next eligible (or stageable).
  const baseChoices: BindingChoice[] = plans.map((plan, planIndex) => {
    if (plan.eligible.length > 0) {
      return {
        planIndex,
        primary: plan.eligible[0]!,
        backups: plan.eligible.slice(1, 2),
        staged: false,
        stagingReasons: [],
      };
    }
    const primary = plan.stageable[0]!;
    const candidate = candidateById.get(primary)!;
    return {
      planIndex,
      primary,
      backups: plan.stageable.slice(1, 2),
      staged: true,
      stagingReasons: [
        `primary candidate ${primary} is state ${candidate.evaluationState} (not verified); organization is staged until promotion gates pass`,
      ],
    };
  });

  // Variant enumeration: swap exactly one role's primary to its next
  // alternative (eligible first, then stageable), in canonical order.
  const variants: BindingChoice[][] = [];
  outer: for (let planIndex = 0; planIndex < plans.length; planIndex += 1) {
    const plan = plans[planIndex]!;
    const alternatives = [...plan.eligible.slice(1), ...plan.stageable];
    for (const alternative of alternatives) {
      if (variants.length + 1 >= maxOrganizations) break outer;
      const swapped = baseChoices.map((choice) => ({ ...choice }));
      const alternativeCandidate = candidateById.get(alternative)!;
      const staged = !isConsequentialEligible(alternativeCandidate);
      swapped[planIndex] = {
        planIndex,
        primary: alternative,
        backups: staged ? [] : plan.eligible.filter((id) => id !== alternative).slice(0, 1),
        staged,
        stagingReasons: staged
          ? [
              `primary candidate ${alternative} is state ${alternativeCandidate.evaluationState} (not verified); organization is staged until promotion gates pass`,
            ]
          : [],
      };
      variants.push(swapped);
    }
  }

  const allChoices = [baseChoices, ...variants];
  const organizations = allChoices.map((choices, index) =>
    sealOrganization(choices, plans, roles, demands, demandById, roleById, candidateById, index),
  );
  organizations.sort((a, b) => (a.organizationId < b.organizationId ? -1 : 1));
  const organizationSetDigest = contentDigest(
    organizations.map((organization) => [organization.organizationId, organizationDigestOf(organization)]),
  );
  return { organizations, organizationSetDigest };
}

/** The body digest of an organization proposal (excludes the derived id). */
export function organizationDigestOf(organization: OrganizationProposal): string {
  return contentDigest({ ...organization, organizationId: undefined });
}

function sealOrganization(
  choices: readonly BindingChoice[],
  plans: readonly RolePlan[],
  roles: readonly RoleProposal[],
  demands: readonly CapabilityDemand[],
  demandById: ReadonlyMap<string, CapabilityDemand>,
  roleById: ReadonlyMap<string, RoleProposal>,
  candidateById: ReadonlyMap<string, CandidateProfile>,
  variantIndex: number,
): OrganizationProposal {
  const roleBindings: OrganizationRoleBinding[] = choices.map((choice) => {
    const plan = plans[choice.planIndex]!;
    return {
      roleProposalId: plan.role.roleProposalId,
      primaryCandidateId: choice.primary,
      backupCandidateIds: [...choice.backups].sort(),
      carriedGapIds: [...plan.carriedGapIds].sort(),
    };
  });
  roleBindings.sort((a, b) => (a.roleProposalId < b.roleProposalId ? -1 : 1));

  const roleOfDemand = new Map<string, string>();
  for (const role of roles) {
    for (const demandId of role.satisfiesDemands) roleOfDemand.set(demandId, role.roleProposalId);
  }

  // Handoffs: one edge per dependency between demands of different roles.
  const handoffMap = new Map<string, HandoffEdge>();
  for (const demand of demands) {
    const toRole = roleOfDemand.get(demand.demandId);
    if (toRole === undefined) continue;
    for (const dependency of demand.dependsOnOperations) {
      const providerDemand = demands.find((candidate) =>
        operationKey(candidate.operation) === operationKey(dependency),
      );
      if (providerDemand === undefined) continue;
      const fromRole = roleOfDemand.get(providerDemand.demandId);
      if (fromRole === undefined || fromRole === toRole) continue;
      const sharedKind =
        [...providerDemand.outputContract.map((entry) => entry.kind)]
          .filter((kind) => demand.inputRepresentations.includes(kind))
          .sort()[0] ?? 'structured';
      const providerEntry =
        providerDemand.outputContract
          .filter((entry) => entry.kind === sharedKind)
          .sort((a, b) => (a.name < b.name ? -1 : 1))[0] ?? { name: 'result', kind: sharedKind };
      const edge: HandoffEdge = {
        fromRoleProposalId: fromRole,
        toRoleProposalId: toRole,
        outputName: providerEntry.name,
        inputName: `input-${sharedKind}`,
        kind: sharedKind,
      };
      handoffMap.set(`${edge.fromRoleProposalId}->${edge.toRoleProposalId}`, edge);
    }
  }
  const handoffs = [...handoffMap.values()].sort((a, b) =>
    a.fromRoleProposalId < b.fromRoleProposalId
      ? -1
      : a.fromRoleProposalId > b.fromRoleProposalId
        ? 1
        : a.toRoleProposalId < b.toRoleProposalId
          ? -1
          : 1,
  );

  // Supervision: cosign -> human review; verification -> automated check.
  const supervisionMap = new Map<string, SupervisionEdge>();
  for (const binding of roleBindings) {
    const role = roleById.get(binding.roleProposalId);
    if (role === undefined) continue;
    if (role.authorityBoundary.requiresHumanCosign) {
      supervisionMap.set(binding.roleProposalId, {
        supervisedRoleProposalId: binding.roleProposalId,
        escalation: 'human-review',
      });
    }
  }
  for (const binding of roleBindings) {
    if (supervisionMap.has(binding.roleProposalId)) continue;
    const role = roleById.get(binding.roleProposalId);
    if (role === undefined) continue;
    const needsCheck = role.satisfiesDemands.some((demandId) => {
      const demand = demandById.get(demandId);
      return demand?.verificationRequired === true;
    });
    if (needsCheck) {
      supervisionMap.set(binding.roleProposalId, {
        supervisedRoleProposalId: binding.roleProposalId,
        escalation: 'automated-check',
      });
    }
  }
  const supervision = [...supervisionMap.values()].sort((a, b) =>
    a.supervisedRoleProposalId < b.supervisedRoleProposalId ? -1 : 1,
  );

  // Estimates: deterministic sums over primary candidates (null when any
  // component is undeclared; mixed currencies collapse to null).
  let latencyTotal = 0;
  let latencyKnown = true;
  const costs: MoneyAmount[] = [];
  let costKnown = true;
  for (const binding of roleBindings) {
    const candidate = candidateById.get(binding.primaryCandidateId);
    if (candidate === undefined) continue;
    if (candidate.latency === undefined) latencyKnown = false;
    else latencyTotal += candidate.latency.p95Milliseconds;
    if (candidate.cost === undefined || candidate.cost.basis === 'none') costKnown = false;
    else costs.push({ currency: candidate.cost.currency, amount: candidate.cost.amount });
  }
  const currencies = [...new Set(costs.map((cost) => cost.currency))];
  const estimatedCost: MoneyAmount | null =
    costKnown && costs.length > 0 && currencies.length === 1
      ? { currency: currencies[0]!, amount: sumDecimalAmounts(costs.map((cost) => cost.amount)) }
      : null;

  const staged = choices.some((choice) => choice.staged);
  const stagingReasons = choices
    .filter((choice) => choice.staged)
    .flatMap((choice) => choice.stagingReasons)
    .sort();

  const label = `organization-${variantIndex}${staged ? '-staged' : ''}`;
  const body = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    organizationId: 'org:0000000000000000',
    label,
    roleBindings,
    handoffs,
    supervision,
    estimates: {
      estimatedLatencyMs: latencyKnown ? latencyTotal : null,
      estimatedCost,
    },
    staged,
    stagingReasons,
  };
  const digest = contentDigest({ ...body, organizationId: undefined });
  const organization: OrganizationProposal = {
    ...body,
    organizationId: `org:${digestSuffix16(digest)}`,
  };
  return organization;
}
