/**
 * Discovery-run assembly + content-addressed lineage (ARCD1.0
 * "Reproducibility", acceptance 8; W045 pin 3 — the W036 digest-chain
 * discipline).
 *
 * Every run is fully reproducible:
 * - the input is CANONICALIZED first (arrays sorted by stable ids), so
 *   identical semantic content in any authoring order yields the same
 *   inputDigest and the same runId;
 * - the artifact is SELF-CONTAINED (input + candidate pool + criteria +
 *   composition bound travel with it), and every derived stage (demands
 *   -> roles -> resolution -> organizations -> evaluation -> selection)
 *   is digest-CHAINED: each stage digest covers the stage content AND
 *   the previous stage digest;
 * - `verifyDiscoveryRun` RE-DERIVES the whole pipeline from the
 *   artifact's own inputs and compares every record set + digest +
 *   chain link; any tampering or broken link is the typed
 *   `lineage-mismatch` error naming the broken stages.
 *
 * ZERO wall-clock / randomness: `createdAt` is caller-supplied and is
 * deliberately NOT part of any digest (records stay verifiable across
 * instants; the run id derives from content only).
 */
import { canonicalJsonStringify } from '@epoch/agent-protocol';
import type {
  CandidateProfile,
  DiscoveryInput,
  DiscoveryResult,
  DiscoveryRun,
  DiscoveryRunArtifact,
  DiscoveryStageLink,
  DiscoveryStageName,
  DiscoveryTenantId,
  DiscoveryTrigger,
  EcosystemDiscoveryRequest,
  EvaluationCriterion,
  Timestamp,
} from './types';
import {
  CAPABILITY_DISCOVERY_CONTRACT_VERSION,
  CAPABILITY_DISCOVERY_RECORD_VERSION,
  DISCOVERY_COMPILER_VERSION,
  ECOSYSTEM_STAGE_CHAIN,
  PROBLEM_DRIVEN_STAGE_CHAIN,
} from './version';
import { contentDigest, digestSuffix16, operationKey } from './canonical';
import { compileCapabilityDemands } from './compile';
import { synthesizeRoleProposals } from './roles';
import { resolveCandidates } from './resolve';
import { composeOrganizations } from './organization';
import { evaluateOrganizations } from './evaluate';

// ---------------------------------------------------------------------------
// Input canonicalization (shuffle-invariant run identity).
// ---------------------------------------------------------------------------

/** Canonical form of a discovery input: every array sorted by stable id. */
export function canonicalDiscoveryInput(input: DiscoveryInput): DiscoveryInput {
  return {
    ...input,
    worldRefs: [...input.worldRefs].sort((a, b) => (a.refId < b.refId ? -1 : 1)),
    evidenceSignals: [...input.evidenceSignals].sort((a, b) =>
      a.evidenceDigest < b.evidenceDigest ? -1 : 1,
    ),
    constraintSignals: [...input.constraintSignals].sort((a, b) =>
      a.constraintId < b.constraintId ? -1 : 1,
    ),
    taskSignals: [...input.taskSignals].sort((a, b) => (a.signalId < b.signalId ? -1 : 1)),
    packContributions: [...input.packContributions]
      .map((pack) => ({
        ...pack,
        demandTemplates: [...pack.demandTemplates].sort((a, b) =>
          a.templateId < b.templateId ? -1 : 1,
        ),
        roleTemplates: [...pack.roleTemplates].sort((a, b) =>
          a.templateId < b.templateId ? -1 : 1,
        ),
        taskSignalBindings: [...pack.taskSignalBindings].sort((a, b) =>
          a.bindingId < b.bindingId ? -1 : 1,
        ),
      }))
      .sort((a, b) => (a.packId < b.packId ? -1 : 1)),
  };
}

/** The input digest over the canonical form. */
export function discoveryInputDigest(input: DiscoveryInput): string {
  return contentDigest(canonicalDiscoveryInput(input));
}

/** The content-addressed run id (run kind + tenant + input + compiler). */
export function discoveryRunIdOf(
  runKind: DiscoveryRun['runKind'],
  tenantId: DiscoveryTenantId,
  inputDigest: string,
): string {
  return `discrun:${digestSuffix16(
    contentDigest({
      runKind,
      tenantId,
      inputDigest,
      compilerVersion: DISCOVERY_COMPILER_VERSION,
    }),
  )}`;
}

// ---------------------------------------------------------------------------
// Stage-chain construction + verification.
// ---------------------------------------------------------------------------

/** Chain a sequence of (stage, contentDigest) pairs into stage links. */
export function chainStages(
  stages: readonly { readonly stage: DiscoveryStageName; readonly contentDigest: string }[],
): DiscoveryStageLink[] {
  let previous: string | null = null;
  return stages.map(({ stage, contentDigest: digest }) => {
    const stageDigest = contentDigest({ stage, content: digest, previous });
    const link: DiscoveryStageLink = {
      stage,
      stageDigest,
      previousStageDigest: previous,
    };
    previous = stageDigest;
    return link;
  });
}

/** Verify a stage chain against recomputed content digests. */
function verifyStageChain(
  stages: readonly DiscoveryStageLink[],
  expectedStages: readonly DiscoveryStageName[],
  contentDigests: ReadonlyMap<DiscoveryStageName, string>,
): DiscoveryStageName[] {
  const broken: DiscoveryStageName[] = [];
  if (stages.length !== expectedStages.length) {
    return [...expectedStages];
  }
  let previous: string | null = null;
  for (let index = 0; index < stages.length; index += 1) {
    const link = stages[index]!;
    const expectedName = expectedStages[index]!;
    if (link.stage !== expectedName) {
      broken.push(expectedName);
      continue;
    }
    if (link.previousStageDigest !== previous) {
      broken.push(link.stage);
      continue;
    }
    const content = contentDigests.get(link.stage);
    const recomputed = contentDigest({ stage: link.stage, content: content ?? null, previous });
    if (recomputed !== link.stageDigest) {
      broken.push(link.stage);
      continue;
    }
    previous = link.stageDigest;
  }
  return broken;
}

/** Deep canonical equality (order-insensitive for JSON values). */
function canonicalEquals(a: unknown, b: unknown): boolean {
  return canonicalJsonStringify(a as never) === canonicalJsonStringify(b as never);
}

// ---------------------------------------------------------------------------
// Problem-driven discovery (stream A) — the full pipeline.
// ---------------------------------------------------------------------------

/** Options for a problem-driven run. */
export interface ProblemDrivenRunOptions {
  readonly at: Timestamp;
  readonly trigger?: DiscoveryTrigger;
  readonly invokedBy?: string | undefined;
  readonly candidates: readonly CandidateProfile[];
  readonly criteria?: readonly EvaluationCriterion[] | undefined;
  readonly maxOrganizations?: number | undefined;
}

/** The default evaluation criteria when none are declared. */
export function defaultEvaluationCriteria(): readonly EvaluationCriterion[] {
  return [
    {
      criterionId: 'coverage-threshold',
      kind: 'hard-constraint',
      metric: 'demand-coverage',
      direction: 'maximize',
      threshold: 0,
    },
    {
      criterionId: 'coverage-objective',
      kind: 'objective',
      metric: 'demand-coverage',
      direction: 'maximize',
      weight: 0.4,
    },
    {
      criterionId: 'evidence-objective',
      kind: 'objective',
      metric: 'evidence-coverage',
      direction: 'maximize',
      weight: 0.3,
    },
    {
      criterionId: 'redundancy-objective',
      kind: 'objective',
      metric: 'redundancy-coverage',
      direction: 'maximize',
      weight: 0.15,
    },
    {
      criterionId: 'spf-objective',
      kind: 'objective',
      metric: 'critical-single-point-count',
      direction: 'minimize',
      weight: 0.15,
    },
  ];
}

/**
 * Run the full problem-driven discovery pipeline (stream A):
 * compile demands -> synthesize roles -> resolve candidates -> compose
 * organizations -> evaluate -> select, sealing the whole lineage. The
 * artifact carries its own candidate pool, criteria and composition
 * bound, so `verifyDiscoveryRun` can re-derive everything.
 */
export function runProblemDrivenDiscovery(
  rawInput: DiscoveryInput,
  options: ProblemDrivenRunOptions,
): DiscoveryResult<DiscoveryRunArtifact> {
  const input = canonicalDiscoveryInput(rawInput);
  const inputDigest = contentDigest(input);
  const runId = discoveryRunIdOf('problem-driven', input.tenantId, inputDigest);
  const candidates = [...options.candidates].sort((a, b) =>
    a.candidateId < b.candidateId ? -1 : 1,
  );
  const criteria = options.criteria ?? defaultEvaluationCriteria();
  const maxOrganizations = options.maxOrganizations ?? 4;

  const compilation = compileCapabilityDemands(input);
  if (!compilation.ok) return compilation;
  const { demandSet } = compilation.value;

  const synthesis = synthesizeRoleProposals(input, demandSet, compilation.value.templateOverrideRejections);

  const resolution = resolveCandidates(
    input,
    synthesis.roleProposals,
    demandSet.demands,
    { profiles: candidates },
    { runId, at: options.at },
  );

  const composition = composeOrganizations(
    synthesis.roleProposals,
    resolution.resolutions,
    demandSet.demands,
    candidates,
    { maxOrganizations },
  );

  const evaluation = evaluateOrganizations(
    composition.organizations,
    synthesis.roleProposals,
    demandSet.demands,
    criteria,
    resolution.matchIndex,
    resolution.resolutions,
  );

  // Ecosystem requests: one per distinct unmet operation (acceptance 5).
  const gapOperations = new Map<string, EcosystemDiscoveryRequest>();
  for (const gap of resolution.gaps) {
    const key = operationKey(gap.operation);
    if (!gapOperations.has(key)) {
      gapOperations.set(key, {
        requestId: `eco-${gap.gapId.replace(/^gap:/, '')}`,
        gapIds: resolution.gaps
          .filter((candidate) => operationKey(candidate.operation) === key)
          .map((candidate) => candidate.gapId)
          .sort(),
        operations: [gap.operation],
        reason: `no known candidate satisfies ${key} (gap ${gap.gapId})`,
      });
    }
  }
  const ecosystemRequests = [...gapOperations.values()].sort((a, b) =>
    a.requestId < b.requestId ? -1 : 1,
  );

  const stages = chainStages([
    { stage: 'inputs', contentDigest: inputDigest },
    { stage: 'demands', contentDigest: demandSet.setDigest },
    { stage: 'roles', contentDigest: synthesis.roleSetDigest },
    { stage: 'resolution', contentDigest: resolution.resolutionDigest },
    { stage: 'organizations', contentDigest: composition.organizationSetDigest },
    { stage: 'evaluation', contentDigest: evaluation.evaluationDigest },
    { stage: 'selection', contentDigest: evaluation.selectionDigest },
  ]);

  const run: DiscoveryRun = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    runId,
    runKind: 'problem-driven',
    tenantId: input.tenantId,
    compilerVersion: DISCOVERY_COMPILER_VERSION,
    contractVersion: CAPABILITY_DISCOVERY_CONTRACT_VERSION,
    trigger: {
      trigger: options.trigger ?? 'manual',
      invokedBy: options.invokedBy,
    },
    inputDigest,
    stages,
    createdAt: options.at,
    templateOverrideRejections: [...synthesis.templateOverrideRejections].sort(),
  };

  return {
    ok: true,
    value: {
      run,
      input,
      candidates,
      criteria,
      maxOrganizations,
      demandSet,
      roleProposals: synthesis.roleProposals,
      resolutions: resolution.resolutions,
      organizations: composition.organizations,
      evaluations: evaluation.evaluations,
      selection: evaluation.selection,
      gaps: resolution.gaps,
      ecosystemRequests,
    },
  };
}

// ---------------------------------------------------------------------------
// Lineage verification (acceptance 8: full re-derivation, tamper-proof).
// ---------------------------------------------------------------------------

/**
 * Re-derive the whole problem-driven pipeline from the artifact's own
 * inputs and verify every record set, digest and chain link. Any tampered
 * record (even with consistently recomputed set digests) fails, because
 * the demands and roles are RE-COMPILED from the sealed input.
 */
export function verifyDiscoveryRun(
  artifact: DiscoveryRunArtifact,
): DiscoveryResult<DiscoveryRunArtifact> {
  const broken = new Set<DiscoveryStageName>();
  const fail = (): DiscoveryResult<DiscoveryRunArtifact> => ({
    ok: false,
    error: {
      code: 'lineage-mismatch',
      message: `discovery run ${artifact.run.runId} lineage verification failed at: ${[...broken].join(', ')}`,
      brokenStages: [...broken],
    },
  });

  // Stage: inputs — identity + digest.
  const inputDigest = contentDigest(artifact.input);
  if (inputDigest !== artifact.run.inputDigest) broken.add('inputs');
  const expectedRunId = discoveryRunIdOf(
    artifact.run.runKind,
    artifact.run.tenantId,
    artifact.run.inputDigest,
  );
  if (expectedRunId !== artifact.run.runId) broken.add('inputs');
  if (broken.size > 0) return fail();

  // Re-derive the pipeline.
  const compilation = compileCapabilityDemands(artifact.input);
  if (!compilation.ok) {
    return {
      ok: false,
      error: compilation.error,
    };
  }
  if (
    !canonicalEquals(compilation.value.demandSet.demands, artifact.demandSet.demands) ||
    compilation.value.demandSet.setDigest !== artifact.demandSet.setDigest
  ) {
    broken.add('demands');
  }

  const synthesis = synthesizeRoleProposals(
    artifact.input,
    compilation.value.demandSet,
    compilation.value.templateOverrideRejections,
  );
  if (
    !canonicalEquals(synthesis.roleProposals, artifact.roleProposals) ||
    !canonicalEquals(synthesis.roleSetDigest, roleSetDigestOf(artifact.roleProposals))
  ) {
    broken.add('roles');
  }

  const resolution = resolveCandidates(
    artifact.input,
    synthesis.roleProposals,
    compilation.value.demandSet.demands,
    { profiles: artifact.candidates },
    { runId: artifact.run.runId, at: artifact.run.createdAt },
  );
  if (
    !canonicalEquals(resolution.resolutions, artifact.resolutions) ||
    !canonicalEquals(resolution.gaps, artifact.gaps) ||
    resolution.resolutionDigest !== resolutionDigestOf(artifact.resolutions)
  ) {
    broken.add('resolution');
  }

  const composition = composeOrganizations(
    synthesis.roleProposals,
    resolution.resolutions,
    compilation.value.demandSet.demands,
    artifact.candidates,
    { maxOrganizations: artifact.maxOrganizations },
  );
  if (
    !canonicalEquals(composition.organizations, artifact.organizations) ||
    composition.organizationSetDigest !== organizationSetDigestOf(artifact.organizations)
  ) {
    broken.add('organizations');
  }

  const evaluation = evaluateOrganizations(
    composition.organizations,
    synthesis.roleProposals,
    compilation.value.demandSet.demands,
    artifact.criteria,
    resolution.matchIndex,
    resolution.resolutions,
  );
  if (
    !canonicalEquals(evaluation.evaluations, artifact.evaluations) ||
    !canonicalEquals(evaluation.selection, artifact.selection)
  ) {
    broken.add('evaluation');
    broken.add('selection');
  }

  // Stage-chain verification with the RECOMPUTED content digests.
  const contentDigests = new Map<DiscoveryStageName, string>([
    ['inputs', inputDigest],
    ['demands', compilation.value.demandSet.setDigest],
    ['roles', synthesis.roleSetDigest],
    ['resolution', resolution.resolutionDigest],
    ['organizations', composition.organizationSetDigest],
    ['evaluation', evaluation.evaluationDigest],
    ['selection', evaluation.selectionDigest],
  ]);
  for (const stage of verifyStageChain(artifact.run.stages, PROBLEM_DRIVEN_STAGE_CHAIN, contentDigests)) {
    broken.add(stage);
  }

  if (broken.size > 0) return fail();
  return { ok: true, value: artifact };
}

/** Recompute the role-set digest from stored roles. */
export function roleSetDigestOf(roles: DiscoveryRunArtifact['roleProposals']): string {
  return contentDigest(
    [...roles]
      .sort((a, b) => (a.roleProposalId < b.roleProposalId ? -1 : 1))
      .map((role) => {
        const body = { ...role, roleProposalId: undefined };
        return [role.roleProposalId, contentDigest(body)];
      }),
  );
}

/** Recompute the resolution-set digest from stored resolutions. */
export function resolutionDigestOf(
  resolutions: DiscoveryRunArtifact['resolutions'],
): string {
  return contentDigest(
    [...resolutions]
      .sort((a, b) => (a.roleProposalId < b.roleProposalId ? -1 : 1))
      .map((resolution) => [resolution.roleProposalId, contentDigest(resolution)]),
  );
}

/** Recompute the organization-set digest from stored organizations. */
export function organizationSetDigestOf(
  organizations: DiscoveryRunArtifact['organizations'],
): string {
  return contentDigest(
    [...organizations]
      .sort((a, b) => (a.organizationId < b.organizationId ? -1 : 1))
      .map((organization) => {
        const body = { ...organization, organizationId: undefined };
        return [organization.organizationId, contentDigest(body)];
      }),
  );
}

// ---------------------------------------------------------------------------
// Ecosystem run (stream B) lineage helpers.
// ---------------------------------------------------------------------------

/** Digest of the gap-update stage content. */
export function gapUpdatesStageDigest(
  openedGaps: readonly CapabilityGapShim[],
  updatedGaps: readonly CapabilityGapShim[],
): string {
  return contentDigest({
    opened: openedGaps.map((gap) => gap.gapId).sort(),
    updated: updatedGaps
      .map((gap) => [gap.gapId, gap.state, gap.transitions.length])
      .sort((a, b) => String(a[0]) < String(b[0]) ? -1 : 1),
  });
}

/** Minimal structural shape used by the gap-update stage digest. */
interface CapabilityGapShim {
  readonly gapId: string;
  readonly state: string;
  readonly transitions: readonly unknown[];
}

/** Digest of the candidates stage content. */
export function candidatesStageDigest(candidates: readonly CandidateProfile[]): string {
  return contentDigest(
    [...candidates]
      .sort((a, b) => (a.candidateId < b.candidateId ? -1 : 1))
      .map((candidate) => [candidate.candidateId, candidate.evaluationState]),
  );
}

/** Digest of the promotions stage content. */
export function promotionsStageDigest(
  promotions: readonly { readonly promotionId: string; readonly recordDigest: string }[],
): string {
  return contentDigest(
    [...promotions]
      .sort((a, b) => (a.promotionId < b.promotionId ? -1 : 1))
      .map((promotion) => [promotion.promotionId, promotion.recordDigest]),
  );
}

/** The content-addressed id of an ecosystem run. */
export function ecosystemRunIdOf(
  tenantId: DiscoveryTenantId,
  scanInputDigest: string,
): string {
  return `discrun:${digestSuffix16(
    contentDigest({
      runKind: 'ecosystem',
      tenantId,
      inputDigest: scanInputDigest,
      compilerVersion: DISCOVERY_COMPILER_VERSION,
    }),
  )}`;
}

/** Assemble an ecosystem run record (stream B lineage). */
export function assembleEcosystemRun(input: {
  readonly tenantId: DiscoveryTenantId;
  readonly trigger: DiscoveryTrigger;
  readonly invokedBy?: string | undefined;
  readonly scanInputDigest: string;
  readonly candidateStageDigest: string;
  readonly gapUpdatesStageContentDigest: string;
  readonly promotionsStageContentDigest: string;
  readonly at: Timestamp;
}): DiscoveryRun {
  const runId = ecosystemRunIdOf(input.tenantId, input.scanInputDigest);
  const stages = chainStages([
    { stage: 'inputs', contentDigest: input.scanInputDigest },
    { stage: 'candidates', contentDigest: input.candidateStageDigest },
    { stage: 'gap-updates', contentDigest: input.gapUpdatesStageContentDigest },
    { stage: 'promotions', contentDigest: input.promotionsStageContentDigest },
  ]);
  return {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    runId,
    runKind: 'ecosystem',
    tenantId: input.tenantId,
    compilerVersion: DISCOVERY_COMPILER_VERSION,
    contractVersion: CAPABILITY_DISCOVERY_CONTRACT_VERSION,
    trigger: { trigger: input.trigger, invokedBy: input.invokedBy },
    inputDigest: input.scanInputDigest,
    stages,
    createdAt: input.at,
    templateOverrideRejections: [],
  };
}

/** Verify an ecosystem run's stage chain shape (tamper detection). */
export function verifyEcosystemRunStageChain(
  run: DiscoveryRun,
  contentDigests: ReadonlyMap<DiscoveryStageName, string>,
): DiscoveryResult<DiscoveryRun> {
  const broken = verifyStageChain(run.stages, ECOSYSTEM_STAGE_CHAIN, contentDigests);
  if (broken.length > 0) {
    return {
      ok: false,
      error: {
        code: 'lineage-mismatch',
        message: `ecosystem run ${run.runId} lineage verification failed at: ${[
          ...new Set(broken),
        ].join(', ')}`,
        brokenStages: [...new Set(broken)],
      },
    };
  }
  return { ok: true, value: run };
}
