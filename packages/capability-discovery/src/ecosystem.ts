/**
 * Ecosystem-driven discovery (ARCD1.0 stream B, acceptance 5 + 6).
 *
 * `trigger: 'gap' | 'scheduled' | 'event'` -> scan source adapters ->
 * candidate ingestion at the safe boundary -> gap updates ->
 * reproducible ecosystem run record. The stream SHARES the capability
 * contribution machinery (ingestion, promotion, gap lifecycle) with
 * problem-driven discovery; it never executes untrusted artifacts, never
 * grants authority, never mutates authoritative state — external claims
 * only enrich candidate knowledge (autonomous-discovery invariants).
 */
import type {
  CandidateProfile,
  CapabilityGap,
  DiscoveryResult,
  DiscoveryRun,
  DiscoveryTrigger,
  DiscoveryTenantId,
  EcosystemProposal,
  EcosystemScanReport,
  PromotionRecord,
  SourceScanQuery,
  Timestamp,
} from './types';
import type { DiscoverySourceAdapter } from './adapters';
import { ingestExternalCandidate } from './candidates';
import { transitionCapabilityGap } from './gap';
import { contentDigest, operationKey } from './canonical';
import {
  assembleEcosystemRun,
  candidatesStageDigest,
  gapUpdatesStageDigest,
  promotionsStageDigest,
  verifyEcosystemRunStageChain,
} from './run';

/** Inputs for one ecosystem discovery run. */
export interface EcosystemRunInput {
  readonly tenantId: DiscoveryTenantId;
  readonly trigger: DiscoveryTrigger;
  readonly invokedBy?: string | undefined;
  /** The gaps driving the scan (only UNSATISFIED/CANDIDATE_FOUND scan). */
  readonly gaps: readonly CapabilityGap[];
  readonly adapters: readonly DiscoverySourceAdapter[];
  /** Known candidates for deduplication (by provenance content digest). */
  readonly existingCandidates: readonly CandidateProfile[];
  /** Promotion records sealed earlier in the same workflow (lineage). */
  readonly promotions?: readonly PromotionRecord[] | undefined;
  readonly scanLimit?: number | undefined;
  readonly at: Timestamp;
}

/** The ecosystem run output. */
export interface EcosystemRunOutcome {
  readonly run: DiscoveryRun;
  readonly scanReport: EcosystemScanReport;
  /** Newly ingested candidate profiles (state `discovered`). */
  readonly ingestedCandidates: readonly CandidateProfile[];
  /** Gap records with the CANDIDATE_FOUND transition appended (if any). */
  readonly updatedGaps: readonly CapabilityGap[];
  readonly duplicateArtifactDigests: readonly string[];
}

/**
 * Run one ecosystem scan. Deterministic: adapters are invoked in
 * canonical id order with a canonical query; artifacts are deduplicated
 * by content digest; gaps transition only when a NEW candidate matches
 * their operation.
 */
export function runEcosystemDiscovery(input: EcosystemRunInput): DiscoveryResult<EcosystemRunOutcome> {
  const scannableStates = new Set(['UNSATISFIED', 'CANDIDATE_FOUND', 'REQUIRES_HUMAN']);
  const gaps = [...input.gaps]
    .filter((gap) => gap.tenantId === input.tenantId && scannableStates.has(gap.state))
    .sort((a, b) => (a.gapId < b.gapId ? -1 : 1));
  const adapters = [...input.adapters].sort((a, b) =>
    a.adapterId < b.adapterId ? -1 : 1,
  );
  const scanLimit = input.scanLimit ?? 50;

  const operations = [
    ...new Map(gaps.map((gap) => [operationKey(gap.operation), gap.operation])).values(),
  ].sort((a, b) => (operationKey(a) < operationKey(b) ? -1 : 1));
  const query: SourceScanQuery = { operations, limit: scanLimit };

  const knownDigests = new Set(
    input.existingCandidates.map((candidate) => candidate.provenance.contentDigest),
  );

  const ingested: CandidateProfile[] = [];
  const duplicateDigests: string[] = [];
  const scannedArtifactOperations = new Map<string, string[]>(); // operationKey -> candidateIds
  for (const adapter of adapters) {
    const result = adapter.scan(query);
    for (const artifact of [...result.artifacts].sort((a, b) =>
      a.artifactId < b.artifactId ? -1 : 1,
    )) {
      if (knownDigests.has(artifact.contentDigest)) {
        duplicateDigests.push(artifact.contentDigest);
        continue;
      }
      const ingestedProfile = ingestExternalCandidate({
        tenantId: input.tenantId,
        adapterId: adapter.adapterId,
        artifact,
      });
      if (!ingestedProfile.ok) return ingestedProfile;
      knownDigests.add(artifact.contentDigest);
      ingested.push(ingestedProfile.value);
      for (const claim of artifact.claimedCapabilities) {
        const key = operationKey(claim.operation);
        const existing = scannedArtifactOperations.get(key) ?? [];
        existing.push(ingestedProfile.value.candidateId);
        scannedArtifactOperations.set(key, existing);
      }
    }
  }
  ingested.sort((a, b) => (a.candidateId < b.candidateId ? -1 : 1));

  // Gap updates: UNSATISFIED (or REQUIRES_HUMAN re-opened to scan) gaps
  // with at least one new matching candidate transition CANDIDATE_FOUND.
  const updatedGaps: CapabilityGap[] = [];
  for (const gap of gaps) {
    const key = operationKey(gap.operation);
    const candidatesForKey = scannedArtifactOperations.get(key) ?? [];
    if (candidatesForKey.length === 0) continue;
    if (gap.state !== 'UNSATISFIED' && gap.state !== 'REQUIRES_HUMAN') continue;
    const transitioned = transitionCapabilityGap(gap, {
      toState: 'CANDIDATE_FOUND',
      at: input.at,
      cause: `ecosystem scan found ${candidatesForKey.length} candidate(s) for ${key}`,
      evidenceDigest: contentDigest({
        candidates: [...candidatesForKey].sort(),
        gap: gap.gapId,
      }),
    });
    if (transitioned.ok) updatedGaps.push(transitioned.value);
  }
  updatedGaps.sort((a, b) => (a.gapId < b.gapId ? -1 : 1));

  // Lineage: inputs (the scan request), candidates, gap-updates, promotions.
  const scanInputDigest = contentDigest({
    tenantId: input.tenantId,
    trigger: input.trigger,
    invokedBy: input.invokedBy,
    adapters: adapters.map((adapter) => adapter.adapterId),
    gapIds: gaps.map((gap) => gap.gapId),
    operations,
    scanLimit,
  });
  const run = assembleEcosystemRun({
    tenantId: input.tenantId,
    trigger: input.trigger,
    invokedBy: input.invokedBy,
    scanInputDigest,
    candidateStageDigest: candidatesStageDigest(ingested),
    gapUpdatesStageContentDigest: gapUpdatesStageDigest([], updatedGaps),
    promotionsStageContentDigest: promotionsStageDigest(input.promotions ?? []),
    at: input.at,
  });

  const verification = verifyEcosystemRunStageChain(run, new Map([
    ['inputs', scanInputDigest],
    ['candidates', candidatesStageDigest(ingested)],
    ['gap-updates', gapUpdatesStageDigest([], updatedGaps)],
    ['promotions', promotionsStageDigest(input.promotions ?? [])],
  ]));
  if (!verification.ok) return verification;

  const scanReport: EcosystemScanReport = {
    adapterIds: adapters.map((adapter) => adapter.adapterId),
    scannedOperations: operations,
    ingestedCandidateIds: ingested.map((candidate) => candidate.candidateId),
    duplicateArtifactDigests: [...new Set(duplicateDigests)].sort(),
  };

  return {
    ok: true,
    value: {
      run,
      scanReport,
      ingestedCandidates: ingested,
      updatedGaps,
      duplicateArtifactDigests: [...new Set(duplicateDigests)].sort(),
    },
  };
}

/** Whether an ecosystem proposal should be derived from gap evidence. */
export function shouldProposeEcosystemArtifact(
  gaps: readonly CapabilityGap[],
  recurringThreshold: number,
): boolean {
  return gaps.filter((gap) => gap.state === 'UNSATISFIED' || gap.state === 'REQUIRES_HUMAN').length >= recurringThreshold;
}

/** Type re-export (proposal derivation lives in proposals.ts). */
export type { EcosystemProposal };
