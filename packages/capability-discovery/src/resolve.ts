/**
 * Candidate resolution (ARCD1.0 step 5, acceptance 3).
 *
 * Compares synthesized role demands against a provider-neutral candidate
 * pool: existing Agent Protocol registrations (W003), Capability Registry
 * records (W007), human capability declarations, and external candidate
 * profiles. The comparison goes through MEASURED/DECLARED CAPABILITY
 * CLAIMS — never a model/provider-to-role mapping (acceptance 3, R37):
 *
 * `demand.operation <-> claimed operation + I/O representation kinds +
 *  quality claim + latency budget`
 *
 * A claim that matches operationally but rests on declaration-only
 * evidence (or an external candidate that has not passed the promotion
 * gates) resolves as `claimed`, never `satisfied`. Unmet demands become
 * explicit {@link CapabilityGap} records (acceptance 5).
 */
import type { AgentRegistration } from '@epoch/agent-protocol';
import { canonicalDigest } from '@epoch/agent-protocol';
import type { CapabilityRecord } from '@epoch/capability-registry';
import type {
  CandidateAssignment,
  CandidateId,
  CandidateMatch,
  CandidateProfile,
  CapabilityDemand,
  CapabilityGap,
  CapabilityGapId,
  CapabilityDemandId,
  DiscoveryInput,
  DiscoveryRunId,
  HumanDeclaration,
  OperationRef,
  RoleProposal,
  RoleResolution,
  Timestamp,
} from './types';
import { CandidateProfileSchema, HumanDeclarationSchema } from './schema';
import { contentDigest, digestSuffix16, operationKey } from './canonical';
import { CAPABILITY_DISCOVERY_RECORD_VERSION } from './version';
import { createCapabilityGap } from './gap';

/** The candidate pool handed to resolution. */
export interface CandidatePool {
  readonly profiles: readonly CandidateProfile[];
}

/** Resolution output for the whole role set. */
export interface ResolutionOutcome {
  readonly resolutions: readonly RoleResolution[];
  /** Digest over the canonically-ordered resolution records (lineage). */
  readonly resolutionDigest: string;
  /** Gaps opened by unmet demands (new records + linked existing ones). */
  readonly gaps: readonly CapabilityGap[];
  /** Match index for downstream evaluation: `demandId|candidateId` -> outcome. */
  readonly matchIndex: ReadonlyMap<string, CandidateMatch['outcome']>;
}

/** Resolve every role proposal against the pool. */
export function resolveCandidates(
  input: DiscoveryInput,
  roleProposals: readonly RoleProposal[],
  demands: readonly CapabilityDemand[],
  pool: CandidatePool,
  options: {
    readonly runId: DiscoveryRunId;
    readonly at: Timestamp;
    /** Known gaps to link instead of duplicating (tenant-scoped). */
    readonly existingGaps?: readonly CapabilityGap[];
  },
): ResolutionOutcome {
  const demandById = new Map(demands.map((demand) => [demand.demandId, demand]));
  const candidateById = new Map(
    [...pool.profiles]
      .sort((a, b) => (a.candidateId < b.candidateId ? -1 : 1))
      .map((profile) => [profile.candidateId, profile]),
  );
  const matchIndex = new Map<string, CandidateMatch['outcome']>();
  const gapsByOperation = new Map<string, CapabilityGap>();
  for (const gap of options.existingGaps ?? []) {
    if (gap.tenantId === input.tenantId) {
      gapsByOperation.set(operationKey(gap.operation), gap);
    }
  }
  const newGaps: CapabilityGap[] = [];
  const linkedGapIds = new Map<CapabilityDemandId, CapabilityGapId>();

  const resolutions = [...roleProposals]
    .sort((a, b) => (a.roleProposalId < b.roleProposalId ? -1 : 1))
    .map((role) => {
      const memberDemands = role.satisfiesDemands
        .map((demandId) => demandById.get(demandId))
        .filter((demand): demand is CapabilityDemand => demand !== undefined);

      // Match every member demand against every candidate.
      const matchesByCandidate = new Map<CandidateId, CandidateMatch[]>();
      for (const demand of memberDemands) {
        for (const [candidateId, candidate] of candidateById) {
          const match = matchDemandToCandidate(demand, candidate);
          matchIndex.set(`${demand.demandId}|${candidateId}`, match.outcome);
          const existing = matchesByCandidate.get(candidateId) ?? [];
          existing.push(match);
          matchesByCandidate.set(candidateId, existing);
        }
      }

      // Assignments: candidates with at least one non-incompatible match.
      const assignments: CandidateAssignment[] = [];
      for (const [candidateId, matches] of [...matchesByCandidate.entries()].sort((a, b) =>
        a[0] < b[0] ? -1 : 1,
      )) {
        const matched = matches.filter((match) => match.outcome === 'satisfied');
        const claimed = matches.filter((match) => match.outcome === 'claimed');
        if (matched.length + claimed.length === 0) continue;
        const score =
          Math.round(
            ((matched.length + 0.5 * claimed.length) / Math.max(memberDemands.length, 1)) * 1000,
          ) / 1000;
        assignments.push({
          candidateId,
          matchedDemandIds: matched.map((match) => match.demandId).sort(),
          claimedDemandIds: claimed.map((match) => match.demandId).sort(),
          incompatibleDemandIds: matches
            .filter((match) => match.outcome === 'incompatible')
            .map((match) => match.demandId)
            .sort(),
          score,
        });
      }
      assignments.sort((a, b) =>
        a.score !== b.score ? b.score - a.score : a.candidateId < b.candidateId ? -1 : 1,
      );

      // Unmet demands: no satisfied or claimed match among any candidate.
      const unmetDemandIds = memberDemands
        .filter(
          (demand) =>
            !assignments.some(
              (assignment) =>
                assignment.matchedDemandIds.includes(demand.demandId) ||
                assignment.claimedDemandIds.includes(demand.demandId),
            ),
        )
        .map((demand) => demand.demandId)
        .sort();

      // Unmet demands become explicit capability gaps (acceptance 5):
      // link an existing tenant gap for the same operation when present.
      const gapIds: CapabilityGapId[] = [];
      for (const demandId of unmetDemandIds) {
        const demand = demandById.get(demandId)!;
        const key = operationKey(demand.operation);
        const existing = gapsByOperation.get(key);
        if (existing !== undefined) {
          gapIds.push(existing.gapId);
          continue;
        }
        const gap = createCapabilityGap({
          tenantId: input.tenantId,
          operation: demand.operation,
          demandSummary: demand.requiredOutcome,
          lifecycleStage: demand.lifecycleStage,
          originatingRunId: options.runId,
          triggeringSignalIds: demand.derivedFromSignals,
          at: options.at,
        });
        gapsByOperation.set(key, gap);
        newGaps.push(gap);
        linkedGapIds.set(demandId, gap.gapId);
        gapIds.push(gap.gapId);
      }

      return {
        roleProposalId: role.roleProposalId,
        assignments,
        unmetDemandIds,
        gapIds: [...gapIds].sort(),
      } satisfies RoleResolution;
    });

  const resolutionDigest = contentDigest(
    resolutions.map((resolution) => [
      resolution.roleProposalId,
      contentDigest(resolution),
    ]),
  );
  const gaps = [...newGaps].sort((a, b) => (a.gapId < b.gapId ? -1 : 1));
  return { resolutions, resolutionDigest, gaps, matchIndex };
}

// ---------------------------------------------------------------------------
// The neutral compatibility check (acceptance 3: model/substrate candidates
// are compared through capability contracts, never names).
// ---------------------------------------------------------------------------

/** Version-constraint satisfaction (`*` admits any; otherwise exact). */
export function operationSatisfies(claim: OperationRef, demand: OperationRef): boolean {
  if (claim.id !== demand.id) return false;
  return demand.versionConstraint === '*' || claim.versionConstraint === demand.versionConstraint;
}

/**
 * Quality-target satisfaction (direction-aware): `min` = the threshold
 * is a MINIMUM acceptable value (claims must be >= it); `max` = the
 * threshold is a MAXIMUM acceptable value (claims must be <= it).
 */
function qualitySatisfies(
  claim: { metric: string; threshold: number; direction: 'min' | 'max' },
  target: { metric: string; threshold: number; direction: 'min' | 'max' },
): boolean | undefined {
  if (claim.metric !== target.metric || claim.direction !== target.direction) return undefined;
  return claim.direction === 'min' ? claim.threshold >= target.threshold : claim.threshold <= target.threshold;
}

/** Match one demand against one candidate profile. */
export function matchDemandToCandidate(
  demand: CapabilityDemand,
  candidate: CandidateProfile,
): CandidateMatch {
  const reasons: string[] = [];
  const claim = candidate.claimedCapabilities.find((capability) =>
    operationSatisfies(capability.operation, demand.operation),
  );
  if (claim === undefined) {
    return {
      demandId: demand.demandId,
      candidateId: candidate.candidateId,
      outcome: 'incompatible',
      reasons: [`no capability claim for operation ${operationKey(demand.operation)}`],
    };
  }

  const missingInputs = demand.inputRepresentations.filter(
    (kind) => !claim.inputKinds.includes(kind),
  );
  if (missingInputs.length > 0) {
    reasons.push(`missing input representations: ${missingInputs.join(', ')}`);
  }
  const requiredOutputKinds = demand.outputContract.map((entry) => entry.kind);
  const missingOutputs = requiredOutputKinds.filter((kind) => !claim.outputKinds.includes(kind));
  if (missingOutputs.length > 0) {
    reasons.push(`missing output representations: ${[...new Set(missingOutputs)].join(', ')}`);
  }
  if (reasons.length > 0) {
    return {
      demandId: demand.demandId,
      candidateId: candidate.candidateId,
      outcome: 'incompatible',
      reasons: reasons.sort(),
    };
  }

  // Operational match. Now the evidence basis:
  let outcome: CandidateMatch['outcome'] =
    claim.claimBasis === 'measured' ? 'satisfied' : 'claimed';
  if (claim.claimBasis === 'declared') {
    reasons.push('capability claim is declaration-only (no measured evidence)');
  }

  if (demand.qualityTarget !== undefined) {
    if (claim.quality === undefined) {
      outcome = 'claimed';
      reasons.push(`quality target ${demand.qualityTarget.metric} has no matching claim`);
    } else {
      const satisfied = qualitySatisfies(claim.quality, demand.qualityTarget);
      if (satisfied === undefined) {
        outcome = 'claimed';
        reasons.push(`claim metric ${claim.quality.metric} differs from target ${demand.qualityTarget.metric}`);
      } else if (!satisfied) {
        return {
          demandId: demand.demandId,
          candidateId: candidate.candidateId,
          outcome: 'incompatible',
          reasons: [
            `quality claim ${claim.quality.metric}=${claim.quality.threshold} does not meet target ${demand.qualityTarget.threshold} (${demand.qualityTarget.direction})`,
          ],
        };
      } else if (claim.claimBasis !== 'measured') {
        outcome = 'claimed';
      }
    }
  }

  if (
    demand.latencyBudgetMs !== undefined &&
    candidate.latency !== undefined &&
    candidate.latency.p95Milliseconds > demand.latencyBudgetMs
  ) {
    return {
      demandId: demand.demandId,
      candidateId: candidate.candidateId,
      outcome: 'incompatible',
      reasons: [
        `latency p95 ${candidate.latency.p95Milliseconds}ms exceeds budget ${demand.latencyBudgetMs}ms`,
      ],
    };
  }

  // External candidates below the promotion gates are never `satisfied`
  // (acceptance 6: non-consequential until the gates pass).
  if (candidate.provenance.sourceKind === 'external-source') {
    const rank = (state: string): number =>
      ['discovered', 'ingested', 'sandboxed', 'profiled', 'evaluated', 'verified'].indexOf(state);
    if (rank(candidate.evaluationState) < 0) {
      return {
        demandId: demand.demandId,
        candidateId: candidate.candidateId,
        outcome: 'incompatible',
        reasons: [`candidate lifecycle state ${candidate.evaluationState} is not resolvable`],
      };
    }
    if (candidate.evaluationState !== 'verified') {
      outcome = 'claimed';
      reasons.push(
        `external candidate has not passed the promotion gates (state ${candidate.evaluationState})`,
      );
    }
  }

  if (demand.authorityConstraints.requiresHumanCosign && candidate.kind !== 'human') {
    outcome = 'claimed';
    reasons.push('demand requires human cosign; non-human candidates need a human cosigner');
  }

  return {
    demandId: demand.demandId,
    candidateId: candidate.candidateId,
    outcome,
    reasons: reasons.sort(),
  };
}

// ---------------------------------------------------------------------------
// Candidate adapters (real W003 / W007 / human surfaces -> profiles).
// ---------------------------------------------------------------------------

/** W003 parameter kind -> neutral representation kind (lossy, neutral). */
export const PARAMETER_KIND_TO_REPRESENTATION: Readonly<
  Record<string, 'numeric' | 'text' | 'structured'>
> = {
  integer: 'numeric',
  number: 'numeric',
  string: 'text',
  boolean: 'text',
  enum: 'text',
  'entity-reference': 'structured',
  json: 'structured',
};

function kindsOfParameterSpecs(
  specs: readonly { readonly kind: string }[],
): ('numeric' | 'text' | 'structured')[] {
  return [
    ...new Set(
      specs.map((spec) => PARAMETER_KIND_TO_REPRESENTATION[spec.kind] ?? 'structured'),
    ),
  ].sort();
}

/** Derive a candidate profile from a REAL Agent Protocol registration (W003). */
export function candidateFromAgentRegistration(registration: AgentRegistration): CandidateProfile {
  const profile: CandidateProfile = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    candidateId: `cand:agent-${registration.agentId.replace(/^agent:/, '')}`,
    kind: 'agent',
    displayName: registration.displayName,
    summary: registration.description ?? registration.displayName,
    claimedCapabilities: registration.capabilities
      .map((capability) => ({
        operation: { id: capability.capabilityId, versionConstraint: '*' },
        inputKinds: kindsOfParameterSpecs(capability.inputs),
        outputKinds: kindsOfParameterSpecs(capability.outputs),
        claimBasis: 'declared' as const,
      }))
      .sort((a, b) => (a.operation.id < b.operation.id ? -1 : 1)),
    runtimeRequirements: [],
    environmentRequirements: [],
    latency: {
      p50Milliseconds: registration.latencyProfile.p50Milliseconds,
      p95Milliseconds: registration.latencyProfile.p95Milliseconds,
    },
    cost:
      registration.costProfile.basis === 'none'
        ? undefined
        : {
            currency: registration.costProfile.currency,
            amount: registration.costProfile.amount,
            basis: registration.costProfile.basis === 'per-proposal' ? 'per-task' : 'per-hour',
          },
    provenance: {
      sourceKind: 'agent-protocol',
      sourceRef: registration.agentId,
      contentDigest: canonicalDigest(registration as never),
    },
    evaluationState: 'verified',
    security: {
      sandboxRequired: false,
      trustDomain: 'epoch-verified',
      notes: ['admitted through the agent-protocol registration pipeline'],
    },
  };
  const parsed = CandidateProfileSchema.safeParse(profile);
  if (!parsed.success) {
    // Registrations map losslessly by construction; a parse failure is a
    // programming error, not a runtime condition.
    throw new Error(`agent registration did not map to a candidate profile: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Derive a candidate profile from a REAL Capability Registry record (W007). */
export function candidateFromCapabilityRecord(record: CapabilityRecord): CandidateProfile {
  const origin = record.manifest.trust.origin;
  const firstParty = origin === 'first-party';
  const profile: CandidateProfile = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    candidateId: `cand:cap-${record.manifest.capabilityId
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')}-${digestSuffix16(record.manifestDigest).slice(0, 8)}`,
    kind: 'capability',
    displayName: record.manifest.descriptor.displayName,
    summary: record.manifest.descriptor.description ?? record.manifest.descriptor.displayName,
    claimedCapabilities: [
      {
        operation: {
          id: record.manifest.capabilityId,
          versionConstraint: record.manifest.version,
        },
        inputKinds: kindsOfParameterSpecs(record.manifest.descriptor.inputs),
        outputKinds: kindsOfParameterSpecs(record.manifest.descriptor.outputs),
        claimBasis: 'declared',
      },
    ],
    runtimeRequirements: [],
    environmentRequirements: [],
    provenance: {
      sourceKind: 'capability-registry',
      sourceRef: record.manifest.capabilityId,
      contentDigest: record.manifestDigest,
    },
    evaluationState: firstParty ? 'verified' : 'evaluated',
    security: {
      sandboxRequired: !firstParty,
      trustDomain: firstParty ? 'epoch-verified' : 'external',
      notes: [
        `registry trust origin ${origin}`,
        ...(record.manifest.descriptor.assumptions.length > 0
          ? [`assumptions: ${record.manifest.descriptor.assumptions.join('; ')}`]
          : []),
      ],
    },
  };
  const parsed = CandidateProfileSchema.safeParse(profile);
  if (!parsed.success) {
    throw new Error(
      `capability record did not map to a candidate profile: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/** Derive a candidate profile from a human capability declaration. */
export function candidateFromHumanDeclaration(declaration: HumanDeclaration): CandidateProfile {
  const parsedDeclaration = HumanDeclarationSchema.safeParse(declaration);
  if (!parsedDeclaration.success) {
    throw new Error(`invalid human declaration: ${parsedDeclaration.error.message}`);
  }
  const admitted = parsedDeclaration.data;
  const profile: CandidateProfile = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    candidateId: `cand:human-${admitted.declarationId.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')}`,
    kind: 'human',
    displayName: admitted.displayName,
    summary: `Human specialist declaration (availability ${admitted.availability}).`,
    claimedCapabilities: [...admitted.claimedCapabilities].sort((a, b) =>
      a.operation.id < b.operation.id ? -1 : 1,
    ),
    runtimeRequirements: [],
    environmentRequirements: [...admitted.environmentRequirements].sort(),
    latency: admitted.latency,
    cost: admitted.cost,
    provenance: {
      sourceKind: 'human-declaration',
      sourceRef: admitted.declarationId,
      contentDigest: contentDigest(admitted),
    },
    evaluationState: 'verified',
    security: {
      sandboxRequired: false,
      trustDomain: 'epoch-verified',
      notes: [
        'authorized human capability declaration',
        `availability: ${admitted.availability}`,
      ],
    },
  };
  const parsed = CandidateProfileSchema.safeParse(profile);
  if (!parsed.success) {
    throw new Error(`human declaration did not map to a candidate profile: ${parsed.error.message}`);
  }
  return parsed.data;
}
