/**
 * TYPED DATA ELIGIBILITY (the W040 pin: "data eligibility states" +
 * "exclusion of unresolved/unvalidated observations"): the
 * deterministic evaluation of one outcome-learning candidate against
 * the eligibility axes, producing one of the four typed states —
 * `eligible | excluded-unvalidated | excluded-unresolved |
 * excluded-foreign-tenant`.
 *
 * - ONLY VALIDATED ACTUALS/OUTCOMES ENTER DATASETS: the actual axis is
 *   validated when the observation group backing the actual is
 *   `corroborated` or `resolved` (the W039 validation states); the
 *   outcome axis is validated when the W036 outcome kind is
 *   `delivered`, `accepted`, or `handover` (OUTCOME_KIND_ELIGIBILITY).
 * - EVERY EXCLUSION IS A TYPED RECORD (never a silent drop): sealed
 *   exclusion records carry the candidate reference, the state, and
 *   the sorted closed-vocabulary reasons.
 * - FOREIGN COMPONENTS: a candidate whose own scope is foreign is
 *   rejected at admission (`tenant-isolation-rejected`); a candidate
 *   whose EMBEDDED components (comparison fact / outcome record) are
 *   foreign to the dataset scope is excluded with the typed
 *   `excluded-foreign-tenant` state — the fold continues.
 * - State precedence (documented, deterministic):
 *   foreign-tenant > unvalidated > unresolved.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { SolutionIdSchema } from '@epoch/solution-delivery';
import {
  CANDIDATE_SCHEMA_NAME,
  EXCLUSION_RECORD_SCHEMA_NAME,
  LEARNING_CALIBRATION_RECORD_VERSION,
  LEARNING_EXCLUSION_REASONS,
  LEARNING_EXCLUSION_STATES,
  OUTCOME_KIND_ELIGIBILITY,
  VALIDATION_STATE_ELIGIBILITY,
  type LearningExclusionReason,
  type LearningEligibilityState,
} from './version';
import { LearningCandidateIdSchema, Sha256HexSchema } from './primitives';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { LearningResult } from './errors';
import {
  OutcomeRecordSlotSchema,
  PackReferenceSchema,
  SealedComparisonFactInputSchema,
  ValidationStateEvidenceSchema,
  VarianceEvidenceSchema,
} from './references';

// --------------------------------------------------------------------------------
// The outcome-learning candidate (the unit of eligible-record intake).
// --------------------------------------------------------------------------------

/**
 * The immutable content of one outcome-learning candidate: one sealed
 * W039-grammar comparison fact + one sealed W036 Outcome-distinction
 * record + the opaque validation-state evidence of the observation
 * group backing the actual + the opaque variance evidence of the
 * compared deviation + the DP1.0 domain-pack context (TYPED REFERENCE)
 * + the universal realization variant (the W036 closed catalog).
 * Candidates are the ONLY intake unit of dataset assembly; the kernel
 * composes the embedded records read-only (history-immutable).
 */
const candidateShape = z.strictObject({
  schema: z.literal(CANDIDATE_SCHEMA_NAME),
  schemaVersion: z.literal(LEARNING_CALIBRATION_RECORD_VERSION),
  candidateId: LearningCandidateIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  comparisonFact: SealedComparisonFactInputSchema,
  outcome: OutcomeRecordSlotSchema,
  validationEvidence: ValidationStateEvidenceSchema,
  varianceEvidence: VarianceEvidenceSchema,
  packRef: PackReferenceSchema,
  realizationVariant: z.enum([
    'construction-build',
    'software-implementation-deployment',
    'mechanical-fabrication-assembly',
    'electrical-installation-commissioning',
    'manufacturing',
    'infrastructure-provisioning',
    'field-service-repair',
  ]),
});

/** The candidate content schema (the intake unit of dataset assembly). */
export const OutcomeLearningCandidateSchema = candidateShape
  .readonly()
  .superRefine((candidate, ctx) => {
    if (candidate.comparisonFact.solutionId !== candidate.solutionId) {
      ctx.addIssue({
        code: 'custom',
        message:
          'the embedded comparison fact subjects a different solution than the candidate scope',
        path: ['comparisonFact.solutionId'],
      });
    }
    if (candidate.outcome.subject.solutionId !== candidate.solutionId) {
      ctx.addIssue({
        code: 'custom',
        message:
          'the embedded outcome record subjects a different solution than the candidate scope',
        path: ['outcome.subject.solutionId'],
      });
    }
    if (
      candidate.comparisonFact.subject.subjectKind !== candidate.outcome.subject.subjectKind ||
      candidate.comparisonFact.subject.subjectId !== candidate.outcome.subject.subjectId
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'the embedded comparison fact and outcome record subject the same (subjectKind, subjectId) anchor',
        path: ['outcome.subject'],
      });
    }
  })
  .meta({
    id: 'OutcomeLearningCandidate',
    title: 'OutcomeLearningCandidate',
    description:
      'The immutable content of one outcome-learning candidate: the sealed comparison fact, the sealed W036 outcome record, the validation-state evidence, the variance evidence, the domain-pack reference, and the universal realization variant.',
  });

/** One outcome-learning candidate content. */
export type OutcomeLearningCandidate = z.infer<typeof OutcomeLearningCandidateSchema>;

/** The SEALED candidate: content plus its SHA-256 content digest. */
export const SealedOutcomeLearningCandidateSchema = z
  .strictObject({
    ...candidateShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedOutcomeLearningCandidate',
    title: 'SealedOutcomeLearningCandidate',
    description:
      'The sealed outcome-learning candidate: immutable content plus its SHA-256 content digest (the exact-revision intake unit of dataset assembly).',
  });

/** One sealed outcome-learning candidate. */
export type SealedOutcomeLearningCandidate = z.infer<typeof SealedOutcomeLearningCandidateSchema>;

/** Compute the content digest of a candidate content (canonical JSON). */
export function computeCandidateDigest(content: OutcomeLearningCandidate): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid candidate content into its published record. */
export function sealOutcomeLearningCandidate(
  content: unknown,
): LearningResult<SealedOutcomeLearningCandidate> {
  const parsed = OutcomeLearningCandidateSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed candidate (schema + digest recomputation). */
export function verifySealedOutcomeLearningCandidate(
  sealed: unknown,
): LearningResult<SealedOutcomeLearningCandidate> {
  const parsed = SealedOutcomeLearningCandidateSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed outcome-learning candidate digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The eligibility evaluation (deterministic, closed vocabularies).
// --------------------------------------------------------------------------------

/** The typed outcome of one eligibility evaluation. */
export interface EligibilityEvaluation {
  readonly state: LearningEligibilityState;
  readonly reasons: readonly LearningExclusionReason[];
}

/**
 * EVALUATE the eligibility of one verified candidate against the
 * dataset scope (the deterministic fold — identical inputs derive
 * identical verdicts):
 *
 * 1. FOREIGN-TENANT tier — an embedded component (the comparison fact
 *    or the outcome record) belonging to a tenant other than the scope
 *    excludes the row as `excluded-foreign-tenant`;
 * 2. UNVALIDATED tier — an `insufficient` observation group (below
 *    quorum — no validated actual) or an unaccepted outcome kind
 *    (`rejected` / `abandoned`) excludes as `excluded-unvalidated`;
 * 3. UNRESOLVED tier — a `conflicting` observation group (still
 *    awaiting a conflict resolution) or a `residual` outcome
 *    (unresolved residuals) excludes as `excluded-unresolved`;
 * 4. otherwise the candidate is `eligible` — its row enters the
 *    dataset.
 *
 * Reasons collect EVERY failing axis (sorted, closed vocabulary); the
 * state is the highest-precedence tier that failed.
 */
export function evaluateEligibility(
  scope: { readonly tenantId: string; readonly solutionId: string },
  candidate: SealedOutcomeLearningCandidate,
): EligibilityEvaluation {
  const reasons: LearningExclusionReason[] = [];
  let tier: 'tenant' | 'unvalidated' | 'unresolved' | null = null;

  if (
    candidate.comparisonFact.tenantId !== scope.tenantId ||
    candidate.outcome.tenantId !== scope.tenantId
  ) {
    reasons.push('tenant-mismatch');
    tier = 'tenant';
  }
  const validationAxis = VALIDATION_STATE_ELIGIBILITY[candidate.validationEvidence.state];
  if (validationAxis === 'unvalidated') {
    reasons.push('observation-group-insufficient');
    if (tier === null) tier = 'unvalidated';
  } else if (validationAxis === 'unresolved') {
    reasons.push('observation-group-conflicting');
    if (tier === null) tier = 'unresolved';
  }
  const outcomeAxis = OUTCOME_KIND_ELIGIBILITY[candidate.outcome.payload.outcomeKind];
  if (outcomeAxis === 'unvalidated') {
    reasons.push('outcome-kind-unaccepted');
    if (tier === null) tier = 'unvalidated';
  } else if (outcomeAxis === 'unresolved') {
    reasons.push('outcome-kind-residual');
    if (tier === null) tier = 'unresolved';
  }

  const state: LearningEligibilityState =
    tier === 'tenant'
      ? 'excluded-foreign-tenant'
      : tier === 'unvalidated'
        ? 'excluded-unvalidated'
        : tier === 'unresolved'
          ? 'excluded-unresolved'
          : 'eligible';
  return { state, reasons: [...reasons].sort() };
}

// --------------------------------------------------------------------------------
// The typed exclusion record (never a silent drop).
// --------------------------------------------------------------------------------

/**
 * The immutable content of one typed exclusion record: the excluded
 * candidate (exact revision), the typed exclusion state, and the sorted
 * closed-vocabulary reasons. Datasets carry their exclusion records
 * alongside their rows — no candidate silently disappears. The record
 * carries NO instant: it lives inside the dataset's PURE fold (zero
 * wall-clock; the assembly instant lives in the
 * `learning:dataset-assembled` event, never in the record).
 */
const exclusionRecordShape = z.strictObject({
  schema: z.literal(EXCLUSION_RECORD_SCHEMA_NAME),
  schemaVersion: z.literal(LEARNING_CALIBRATION_RECORD_VERSION),
  exclusionId: z.string().regex(/^exclusion:[a-z0-9][a-z0-9-]{0,62}$/),
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  candidateRef: z
    .strictObject({
      recordId: LearningCandidateIdSchema,
      contentDigest: Sha256HexSchema,
    })
    .readonly(),
  state: z.enum(LEARNING_EXCLUSION_STATES),
  reasons: z.array(z.enum(LEARNING_EXCLUSION_REASONS)).max(8),
});

export const ExclusionRecordContentSchema = exclusionRecordShape
  .readonly()
  .superRefine((exclusion, ctx) => {
    if (exclusion.reasons.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'an exclusion record carries at least one closed-vocabulary reason',
        path: ['reasons'],
      });
    }
    for (let i = 1; i < exclusion.reasons.length; i += 1) {
      if (exclusion.reasons[i]! < exclusion.reasons[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'reasons must be sorted ascending (deterministic serialization)',
          path: ['reasons'],
        });
        break;
      }
      if (exclusion.reasons[i]! === exclusion.reasons[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'reasons must be duplicate-free',
          path: ['reasons'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ExclusionRecordContent',
    title: 'ExclusionRecordContent',
    description:
      'The immutable content of one typed exclusion record: the excluded candidate reference, the typed exclusion state, and the sorted closed-vocabulary reasons (never a silent drop).',
  });

/** One exclusion-record content. */
export type ExclusionRecordContent = z.infer<typeof ExclusionRecordContentSchema>;

/** The SEALED exclusion record: content plus its SHA-256 content digest. */
export const SealedExclusionRecordSchema = z
  .strictObject({
    ...exclusionRecordShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedExclusionRecord',
    title: 'SealedExclusionRecord',
    description:
      'The sealed typed exclusion record: immutable content plus its SHA-256 content digest (exact-revision addressing of the exclusion history).',
  });

/** One sealed exclusion record. */
export type SealedExclusionRecord = z.infer<typeof SealedExclusionRecordSchema>;

/** Compute the content digest of an exclusion-record content (canonical JSON). */
export function computeExclusionRecordDigest(content: ExclusionRecordContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid exclusion-record content into its published record. */
export function sealExclusionRecord(content: unknown): LearningResult<SealedExclusionRecord> {
  const parsed = ExclusionRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed exclusion record (schema + digest recomputation). */
export function verifySealedExclusionRecord(
  sealed: unknown,
): LearningResult<SealedExclusionRecord> {
  const parsed = SealedExclusionRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed exclusion record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
