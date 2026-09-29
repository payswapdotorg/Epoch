/**
 * The safe candidate ingestion + promotion boundary (CC1.0, acceptance 6).
 *
 * External candidates enter the plane as `discovered` profiles —
 * sandbox-required, outside the Epoch trust domain, described ONLY by
 * provider-neutral capability claims (never a name-to-role mapping, never
 * an authority grant: the profile type has structurally NO field that
 * could carry execution authority — negative test a).
 *
 * The promotion gate admits ONLY the CC1.0 successor transitions, each
 * with its mandatory evidence:
 *   discovered -> ingested -> sandboxed (sandbox report, passed, isolated)
 *              -> profiled -> evaluated (measured evidence, all passed)
 *              -> verified (human policy approval — security stays
 *                 OUTSIDE model prompts, acceptance 9).
 * Skipping a step, promoting an unverified candidate, or promoting
 * without the required evidence is the typed `promotion-gate-rejected`
 * failure (negative test c). Promotion records are hash-chained and
 * content-addressed (acceptance 8).
 */
import type {
  CandidateEvaluationEvidence,
  CandidateEvaluationState,
  CandidateId,
  CandidateProfile,
  DiscoveryResult,
  DiscoveryTenantId,
  PolicyApproval,
  PromotionRecord,
  SandboxReport,
  SourceArtifact,
  Timestamp,
} from './types';
import { CandidateProfileSchema } from './schema';
import { contentDigest, digestSuffix16, operationKey } from './canonical';
import { CAPABILITY_DISCOVERY_RECORD_VERSION, CANDIDATE_PROMOTION_TRANSITIONS } from './version';
import { typedError } from './errors';

/**
 * Ingest one external source artifact as a candidate profile at the
 * boundary: state `discovered`, sandbox required, trust domain `external`.
 * The id is content-addressed over the artifact, so the same artifact
 * ingested twice yields the same candidate (deduplication anchor).
 */
export function ingestExternalCandidate(input: {
  readonly tenantId: DiscoveryTenantId;
  readonly adapterId: string;
  readonly artifact: SourceArtifact;
}): DiscoveryResult<CandidateProfile> {
  const artifactDigest = contentDigest(input.artifact);
  const profile: CandidateProfile = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    candidateId: `cand:ext-${digestSuffix16(artifactDigest).slice(0, 12)}`,
    kind: 'external',
    displayName: `External candidate ${input.artifact.artifactId}`,
    summary: input.artifact.summary,
    claimedCapabilities: [...input.artifact.claimedCapabilities]
      .sort((a, b) => (operationKey(a.operation) < operationKey(b.operation) ? -1 : 1))
      .map((claim) => ({ ...claim, claimBasis: 'declared' as const })),
    runtimeRequirements: [],
    environmentRequirements: [...input.artifact.environmentNotes].sort(),
    provenance: {
      sourceKind: 'external-source',
      sourceRef: input.artifact.artifactId,
      contentDigest: artifactDigest,
      external: { adapterId: input.adapterId, artifactId: input.artifact.artifactId },
    },
    evaluationState: 'discovered',
    security: {
      sandboxRequired: true,
      trustDomain: 'external',
      notes: [
        'untrusted external artifact: outside the Epoch trust domain until sandbox/profile/evaluation/policy gates pass',
        ...(input.artifact.licenseNote !== undefined
          ? [`license note: ${input.artifact.licenseNote}`]
          : []),
      ],
    },
  };
  const parsed = CandidateProfileSchema.safeParse(profile);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'external artifact did not map to a candidate profile',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.') || '$',
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Inputs for one promotion attempt (the gate's evidence bundle). */
export interface PromotionInput {
  readonly candidate: CandidateProfile;
  readonly targetState: CandidateEvaluationState;
  /** Digest of the evidence bundle backing the promotion. */
  readonly evidenceDigest: string;
  /** Required when target is `sandboxed`. */
  readonly sandboxReport?: SandboxReport | undefined;
  /** Required when target is `evaluated`; every entry must pass. */
  readonly evaluationEvidence?: readonly CandidateEvaluationEvidence[] | undefined;
  /** Required when target is `verified` (human policy approval). */
  readonly policyApproval?: PolicyApproval | undefined;
  readonly note?: string | undefined;
  readonly at: Timestamp;
  /** Chain link to the candidate's previous promotion record (if any). */
  readonly previousPromotionDigest: string | null;
}

/** Gate outcome: the sealed promotion record + the promoted profile. */
export interface PromotionOutcome {
  readonly record: PromotionRecord;
  readonly promoted: CandidateProfile;
}

/**
 * The promotion gate (acceptance 6, negative test c). Total: every
 * failure is the typed `promotion-gate-rejected` / `validation` value.
 */
export function promoteCandidate(input: PromotionInput): DiscoveryResult<PromotionOutcome> {
  const { candidate, targetState } = input;
  const allowed = CANDIDATE_PROMOTION_TRANSITIONS[candidate.evaluationState] ?? [];
  if (!allowed.includes(targetState)) {
    return {
      ok: false,
      error: typedError(
        'promotion-gate-rejected',
        `candidate ${candidate.candidateId} cannot promote ${candidate.evaluationState} -> ${targetState} ` +
          `(allowed: ${allowed.join(', ') || 'none'}); the CC1.0 successor chain and its evidence gates are mandatory`,
      ),
    };
  }

  if (targetState === 'sandboxed') {
    const report = input.sandboxReport;
    if (
      report === undefined ||
      !report.passed ||
      report.isolationLevel === 'none'
    ) {
      return {
        ok: false,
        error: typedError(
          'promotion-gate-rejected',
          `candidate ${candidate.candidateId} cannot promote to sandboxed: a PASSED sandbox report with a real isolation level is required`,
        ),
      };
    }
  }

  if (targetState === 'evaluated') {
    const evidence = input.evaluationEvidence ?? [];
    if (
      evidence.length === 0 ||
      !evidence.every((entry) => entry.passed)
    ) {
      return {
        ok: false,
        error: typedError(
          'promotion-gate-rejected',
          `candidate ${candidate.candidateId} cannot promote to evaluated: measured evaluation evidence with every entry passed is required`,
        ),
      };
    }
  }

  if (targetState === 'verified') {
    if (input.policyApproval === undefined) {
      return {
        ok: false,
        error: typedError(
          'promotion-gate-rejected',
          `candidate ${candidate.candidateId} cannot promote to verified: a human policy approval is required (security decisions stay outside model prompts)`,
        ),
      };
    }
  }

  const content = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    candidateId: candidate.candidateId,
    fromState: candidate.evaluationState,
    toState: targetState,
    evidenceDigest: input.evidenceDigest,
    sandboxReport: input.sandboxReport,
    evaluationEvidence: input.evaluationEvidence,
    policyApproval: input.policyApproval,
    note: input.note,
    promotedAt: input.at,
    previousPromotionDigest: input.previousPromotionDigest,
  };
  const recordDigest = contentDigest(content);
  const record: PromotionRecord = {
    ...content,
    promotionId: `promo:${digestSuffix16(recordDigest)}`,
    recordDigest,
  };

  // The promoted profile: only the evaluation state and (on verify) the
  // trust domain change — never the claims (claims may only be revised by
  // re-ingestion as a new candidate revision).
  const promoted: CandidateProfile = {
    ...candidate,
    evaluationState: targetState,
    security:
      targetState === 'verified'
        ? {
            ...candidate.security,
            trustDomain: 'epoch-verified',
            notes: [
              ...candidate.security.notes,
              `verified through the promotion gate with policy approval by ${input.policyApproval?.approvedBy ?? 'unknown'}`,
            ].sort(),
          }
        : candidate.security,
  };
  const parsed = CandidateProfileSchema.safeParse(promoted);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'promotion produced an invalid candidate profile',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.') || '$',
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: { record, promoted: parsed.data } };
}

/** Verify a promotion chain (each record links to its predecessor). */
export function verifyPromotionChain(
  records: readonly PromotionRecord[],
): DiscoveryResult<readonly PromotionRecord[]> {
  let previous: string | null = null;
  for (const record of [...records].sort((a, b) =>
    a.promotedAt < b.promotedAt ? -1 : a.promotedAt > b.promotedAt ? 1 : 0,
  )) {
    if (record.previousPromotionDigest !== previous) {
      return {
        ok: false,
        error: typedError(
          'promotion-gate-rejected',
          `promotion chain broken at ${record.promotionId}: previous-promotion link mismatch`,
        ),
      };
    }
    const content = { ...record, promotionId: undefined, recordDigest: undefined };
    if (contentDigest(content) !== record.recordDigest) {
      return {
        ok: false,
        error: typedError(
          'promotion-gate-rejected',
          `promotion record ${record.promotionId} has a tampered digest`,
        ),
      };
    }
    previous = record.recordDigest;
  }
  return { ok: true, value: records };
}

/** The content digest of a promotion record (excludes id + recordDigest). */
export function promotionRecordDigestOf(record: PromotionRecord): string {
  return contentDigest({ ...record, promotionId: undefined, recordDigest: undefined });
}

/** Candidate id helper for stores. */
export function candidateIdOf(profile: CandidateProfile): CandidateId {
  return profile.candidateId;
}
