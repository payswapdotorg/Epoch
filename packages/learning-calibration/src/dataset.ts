/**
 * PREDICTION-TO-OUTCOME DATASETS (the W040 pin): sealed, versioned,
 * content-addressed records — the deterministic fold over eligible
 * outcome-learning candidates (each embedding one W039-grammar
 * comparison fact + one W036 outcome record + typed evidence).
 *
 * - CONTENT-ADDRESSED: the dataset id derives from the sorted input
 *   candidate digests; identical eligible inputs derive identical
 *   dataset ids AND identical dataset digests (pure fold — no
 *   timestamps, no principals, zero wall-clock; the assembly instant
 *   lives in the `learning:dataset-assembled` EVENT, never in the
 *   record);
 * - each ROW carries the PREDICTION reference by exact digest, the
 *   OUTCOME reference by exact digest, the derived error/variance
 *   FEATURES, the domain-pack context by TYPED REFERENCE, and the
 *   universal realization variant (the W036 closed catalog);
 * - every EXCLUDED candidate is a typed exclusion record carried on
 *   the dataset (never a silent drop);
 * - every row carries W006-convention PROVENANCE: the exact-revision
 *   references of the source comparison fact and outcome record (the
 *   observation digests the registry lineage later binds to);
 * - the kernel NEVER mutates the source facts/outcomes — the assembly
 *   reads them and returns new sealed records (`history-immutable`:
 *   no write path exists; the inputs are read-only by construction).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  CurrencyCodeSchema,
  DistinctionSubjectSchema,
  REALIZATION_VARIANTS,
  TenantIdSchema,
  UnitLabelSchema,
  type SealedDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  DATASET_ROW_SCHEMA_NAME,
  LEARNING_CALIBRATION_RECORD_VERSION,
  LEARNING_DATASET_SCHEMA_NAME,
  LEARNING_ELIGIBILITY_RULESET_VERSION,
  LEARNING_MEASURE_CLASSES,
  scopeSlug,
} from './version';
import {
  LearningDatasetIdSchema,
  LearningRowIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
} from './primitives';
import {
  ActualSideReferenceSchema,
  ComparisonRecordReferenceSchema,
  ForecastSideReferenceSchema,
  OutcomeRecordReferenceSchema,
  PackReferenceSchema,
  type SealedComparisonFactInput,
  type SealedOutcomeRecord,
} from './references';
import {
  evaluateEligibility,
  SealedExclusionRecordSchema,
  sealExclusionRecord,
  verifySealedOutcomeLearningCandidate,
  type SealedExclusionRecord,
  type SealedOutcomeLearningCandidate,
} from './eligibility';
import {
  ErrorVarianceFeaturesSchema,
  LearningBandThresholdsSchema,
  deriveErrorVarianceFeatures,
  type LearningBandThresholds,
} from './features';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { LearningResult } from './errors';

// --------------------------------------------------------------------------------
// The dataset row (prediction reference -> outcome reference + features).
// --------------------------------------------------------------------------------

/** One exact-revision provenance reference to a source observation record. */
const ObservationProvenanceRefSchema = z
  .strictObject({
    recordId: z.string().min(1).max(128),
    contentDigest: Sha256HexSchema,
  })
  .readonly();

/**
 * The immutable content of one dataset row: the PREDICTION reference
 * (the exact forecast revision the comparison fact judged), the
 * OUTCOME reference (the exact W036 outcome record), the actual-side
 * and comparison-record references, the subject, the measure class
 * (plus unit/currency where applicable), the derived error/variance
 * features, the domain-pack context by TYPED REFERENCE, the universal
 * realization variant, the observation instant, and the W006-convention
 * provenance (the exact digests of the source comparison fact and
 * outcome record).
 */
const datasetRowShape = z.strictObject({
  schema: z.literal(DATASET_ROW_SCHEMA_NAME),
  schemaVersion: z.literal(LEARNING_CALIBRATION_RECORD_VERSION),
  rowId: LearningRowIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  subject: DistinctionSubjectSchema,
  predictionRef: ForecastSideReferenceSchema,
  outcomeRef: OutcomeRecordReferenceSchema,
  actualRef: ActualSideReferenceSchema,
  comparisonRef: ComparisonRecordReferenceSchema,
  measureClass: z.enum(LEARNING_MEASURE_CLASSES),
  unit: UnitLabelSchema.optional(),
  currency: CurrencyCodeSchema.optional(),
  features: ErrorVarianceFeaturesSchema,
  packRef: PackReferenceSchema,
  realizationVariant: z.enum(REALIZATION_VARIANTS),
  observedAt: TimestampSchema,
  provenance: z
    .strictObject({
      comparisonFact: ObservationProvenanceRefSchema,
      outcomeRecord: ObservationProvenanceRefSchema,
    })
    .readonly(),
});

export const DatasetRowContentSchema = datasetRowShape
  .readonly()
  .superRefine((row, ctx) => {
    if (row.measureClass === 'quantity' && row.unit === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a quantity-class row carries its unit',
        path: ['unit'],
      });
    }
    if (row.measureClass === 'cost' && row.currency === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a cost-class row carries its currency',
        path: ['currency'],
      });
    }
    if (row.measureClass !== 'quantity' && row.unit !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only quantity-class rows carry a unit',
        path: ['unit'],
      });
    }
    if (row.measureClass !== 'cost' && row.currency !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only cost-class rows carry a currency',
        path: ['currency'],
      });
    }
  })
  .meta({
    id: 'DatasetRowContent',
    title: 'DatasetRowContent',
    description:
      'The immutable content of one dataset row: prediction and outcome references by exact digest, error/variance features, domain-pack context by typed reference, realization variant, and W006-convention provenance.',
  });

/** One dataset-row content. */
export type DatasetRowContent = z.infer<typeof DatasetRowContentSchema>;

/** The SEALED dataset row: content plus its SHA-256 content digest. */
export const SealedDatasetRowSchema = z
  .strictObject({
    ...datasetRowShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedDatasetRow',
    title: 'SealedDatasetRow',
    description:
      'The sealed dataset row: immutable content plus its SHA-256 content digest (exact-revision addressing of one prediction-to-outcome observation).',
  });

/** One sealed dataset row. */
export type SealedDatasetRow = z.infer<typeof SealedDatasetRowSchema>;

/** Compute the content digest of a dataset-row content (canonical JSON). */
export function computeDatasetRowDigest(content: DatasetRowContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid dataset-row content into its published record. */
export function sealDatasetRow(content: unknown): LearningResult<SealedDatasetRow> {
  const parsed = DatasetRowContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed dataset row (schema + digest recomputation). */
export function verifySealedDatasetRow(sealed: unknown): LearningResult<SealedDatasetRow> {
  const parsed = SealedDatasetRowSchema.safeParse(sealed);
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
          'sealed dataset row digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The learning dataset (the sealed fold).
// --------------------------------------------------------------------------------

/**
 * The immutable content of one learning dataset — the deterministic
 * fold over the admitted candidates: the assembly policy (band
 * thresholds + the eligibility ruleset version), the canonically
 * ordered rows, the typed exclusion records, the counts, and the
 * sorted input candidate digests (the content-addressing base: the
 * dataset id derives from them). NO timestamps, NO principals — a
 * pure fold over sealed history (the W039 calibration-state
 * discipline); the assembly instant lives in the
 * `learning:dataset-assembled` event.
 */
const learningDatasetShape = z.strictObject({
  schema: z.literal(LEARNING_DATASET_SCHEMA_NAME),
  schemaVersion: z.literal(LEARNING_CALIBRATION_RECORD_VERSION),
  datasetId: LearningDatasetIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  assemblyPolicy: z
    .strictObject({
      bandThresholds: LearningBandThresholdsSchema,
      eligibilityRulesetVersion: z.literal(LEARNING_ELIGIBILITY_RULESET_VERSION),
    })
    .readonly(),
  rows: z.array(SealedDatasetRowSchema).max(4096),
  exclusions: z.array(SealedExclusionRecordSchema).max(4096),
  eligibleCount: z.number().int().min(0).max(4096),
  excludedCount: z.number().int().min(0).max(4096),
  inputDigests: z.array(Sha256HexSchema).max(4096),
});

export const LearningDatasetContentSchema = learningDatasetShape
  .readonly()
  .superRefine((dataset, ctx) => {
    for (let i = 1; i < dataset.rows.length; i += 1) {
      if (dataset.rows[i]!.rowId < dataset.rows[i - 1]!.rowId) {
        ctx.addIssue({
          code: 'custom',
          message: 'rows must be sorted by rowId ascending (deterministic serialization)',
          path: ['rows'],
        });
        break;
      }
      if (dataset.rows[i]!.rowId === dataset.rows[i - 1]!.rowId) {
        ctx.addIssue({
          code: 'custom',
          message: 'rows must be duplicate-free by rowId',
          path: ['rows'],
        });
        break;
      }
    }
    for (let i = 1; i < dataset.exclusions.length; i += 1) {
      if (dataset.exclusions[i]!.exclusionId < dataset.exclusions[i - 1]!.exclusionId) {
        ctx.addIssue({
          code: 'custom',
          message: 'exclusions must be sorted by exclusionId ascending (deterministic serialization)',
          path: ['exclusions'],
        });
        break;
      }
      if (dataset.exclusions[i]!.exclusionId === dataset.exclusions[i - 1]!.exclusionId) {
        ctx.addIssue({
          code: 'custom',
          message: 'exclusions must be duplicate-free by exclusionId',
          path: ['exclusions'],
        });
        break;
      }
    }
    if (dataset.eligibleCount !== dataset.rows.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'eligibleCount must equal rows.length',
        path: ['eligibleCount'],
      });
    }
    if (dataset.excludedCount !== dataset.exclusions.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'excludedCount must equal exclusions.length',
        path: ['excludedCount'],
      });
    }
    for (let i = 1; i < dataset.inputDigests.length; i += 1) {
      if (dataset.inputDigests[i]! < dataset.inputDigests[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'inputDigests must be sorted ascending (deterministic serialization)',
          path: ['inputDigests'],
        });
        break;
      }
      if (dataset.inputDigests[i]! === dataset.inputDigests[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'inputDigests must be duplicate-free',
          path: ['inputDigests'],
        });
        break;
      }
    }
    if (dataset.eligibleCount + dataset.excludedCount !== dataset.inputDigests.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'eligibleCount + excludedCount must equal inputDigests.length',
        path: ['inputDigests'],
      });
    }
  })
  .meta({
    id: 'LearningDatasetContent',
    title: 'LearningDatasetContent',
    description:
      'The immutable content of one learning dataset: the assembly policy, the canonically ordered prediction-to-outcome rows, the typed exclusion records, the counts, and the sorted input digests (the content-addressing base).',
  });

/** One learning-dataset content. */
export type LearningDatasetContent = z.infer<typeof LearningDatasetContentSchema>;

/** The SEALED learning dataset: content plus its SHA-256 content digest. */
export const SealedLearningDatasetSchema = z
  .strictObject({
    ...learningDatasetShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedLearningDataset',
    title: 'SealedLearningDataset',
    description:
      'The sealed learning dataset: immutable fold content plus its SHA-256 content digest (identical eligible inputs derive identical digests).',
  });

/** One sealed learning dataset. */
export type SealedLearningDataset = z.infer<typeof SealedLearningDatasetSchema>;

/** Compute the content digest of a dataset content (canonical JSON). */
export function computeLearningDatasetDigest(content: LearningDatasetContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid dataset content into its published record. */
export function sealLearningDataset(content: unknown): LearningResult<SealedLearningDataset> {
  const parsed = LearningDatasetContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed learning dataset (schema + digest recomputation). */
export function verifySealedLearningDataset(
  sealed: unknown,
): LearningResult<SealedLearningDataset> {
  const parsed = SealedLearningDatasetSchema.safeParse(sealed);
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
          'sealed learning dataset digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The deterministic assembly fold.
// --------------------------------------------------------------------------------

/**
 * Deterministically derive the dataset id of one input set:
 * `dataset:<solution-slug>-<setDigest-prefix>` over the sorted input
 * candidate digests — identical inputs derive identical ids (replay
 * idempotence; the store seals the PRIOR record on re-admission).
 */
function deriveDatasetId(solutionId: string, inputDigests: readonly string[]): string {
  const setDigest = canonicalDigest(inputDigests as unknown as JsonValue);
  return `dataset:${scopeSlug(solutionId)}-${setDigest.slice(0, 8)}`;
}

/**
 * Deterministically derive the row id of one prediction/outcome pair:
 * `row:<prediction-slug>-<outcome-slug>-<pairDigest-prefix>` over the
 * two exact content digests.
 */
function deriveRowId(predictionRecordId: string, outcomeRecordId: string, pairDigest: string): string {
  return `row:${scopeSlug(predictionRecordId)}-${scopeSlug(outcomeRecordId)}-${pairDigest.slice(0, 8)}`;
}

/** Narrow a verified W036 distinction record to its outcome member (typed guard). */
function asOutcomeRecord(
  record: SealedDistinctionRecord,
): LearningResult<SealedOutcomeRecord> {
  if (record.kind !== 'outcome') {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `record "${record.recordId}" is of kind "${record.kind}" — the outcome slot carries W036 Outcome-distinction records only`,
        issues: [{ path: 'outcome.kind', message: 'only outcome records enter the outcome slot' }],
      },
    };
  }
  return { ok: true, value: record };
}

/** The registered-history pool the assembly cross-checks candidates against. */
export interface AssemblyEvidencePool {
  /** The registered W039-grammar comparison facts (append-only history). */
  readonly comparisonFacts: readonly SealedComparisonFactInput[];
  /** The registered W036 Outcome-distinction records (append-only history). */
  readonly outcomeRecords: readonly SealedDistinctionRecord[];
}

/** The options of {@link assembleDataset}. */
export interface DatasetAssemblyOptions {
  /** The caller-supplied magnitude-band thresholds (never implicit defaults). */
  readonly bandThresholds: LearningBandThresholds;
}

/**
 * ASSEMBLE the learning dataset of one scope — the deterministic fold
 * over the supplied candidates (the eligible-record intake of the
 * service layer; the kernel itself is pure):
 *
 * 1. every candidate VERIFIES (schema + digest recomputation — tamper
 *    detection) and matches the assembly scope — a candidate whose OWN
 *    tenant differs from the scope is `tenant-isolation-rejected` at
 *    admission (R12);
 * 2. every candidate's embedded comparison fact and outcome record are
 *    REGISTERED history: the evidence pool must carry the exact
 *    revisions (a stale or unknown reference is
 *    `dangling-reference-rejected`);
 * 3. duplicate candidates collapse idempotently; a different candidate
 *    under a known id is a typed `version-conflict`; a second
 *    candidate for the SAME (prediction, outcome) pair is a typed
 *    `history-immutable` (the pair verdict is fixed);
 * 4. ELIGIBILITY evaluates per candidate: eligible candidates fold
 *    into rows (features derived deterministically), excluded
 *    candidates fold into typed exclusion records;
 * 5. rows and exclusions sort canonically; the dataset id derives from
 *    the sorted input digests; the result seals.
 *
 * The source facts/outcomes are READ-ONLY inputs (history-immutable —
 * no write path exists); the fold never depends on input order.
 */
export function assembleDataset(
  scope: { readonly tenantId: string; readonly solutionId: string },
  pool: AssemblyEvidencePool,
  candidates: readonly unknown[],
  options: DatasetAssemblyOptions,
): LearningResult<SealedLearningDataset> {
  // 0. The assembly policy itself must be valid.
  const thresholds = LearningBandThresholdsSchema.safeParse(options.bandThresholds);
  if (!thresholds.success) {
    return { ok: false, error: validationError(thresholds.error) };
  }
  const bandThresholds = thresholds.data;

  if (candidates.length === 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'a dataset assembly requires at least one candidate',
        issues: [{ path: 'candidates', message: 'empty candidate set' }],
      },
    };
  }

  const poolFacts = new Map<string, string>();
  for (const fact of pool.comparisonFacts) {
    poolFacts.set(fact.factId, fact.contentDigest);
  }
  const poolOutcomes = new Map<string, string>();
  for (const outcome of pool.outcomeRecords) {
    poolOutcomes.set(outcome.recordId, outcome.contentDigest);
  }

  // 1-3. Verify, scope-check, pool-cross-check, deduplicate.
  const verifiedCandidates = new Map<string, SealedOutcomeLearningCandidate>();
  const pairs = new Map<string, string>();
  for (const candidate of candidates) {
    const verified = verifySealedOutcomeLearningCandidate(candidate);
    if (!verified.ok) {
      return verified;
    }
    const admitted = verified.value;
    if (admitted.tenantId !== scope.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `candidate "${admitted.candidateId}" belongs to tenant "${admitted.tenantId}" but the assembly scope is "${scope.tenantId}" (R12)`,
          expectedTenantId: scope.tenantId,
          encounteredTenantId: admitted.tenantId,
          subject: admitted.candidateId,
        },
      };
    }
    if (admitted.solutionId !== scope.solutionId) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `candidate "${admitted.candidateId}" subjects solution "${admitted.solutionId}" but the assembly scope is "${scope.solutionId}"`,
          issues: [{ path: 'solutionId', message: 'candidate/scope solution mismatch' }],
        },
      };
    }
    const existing = verifiedCandidates.get(admitted.candidateId);
    if (existing !== undefined) {
      if (existing.contentDigest === admitted.contentDigest) {
        continue; // exact duplicate intake collapses (idempotent)
      }
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `candidate "${admitted.candidateId}" is supplied twice with different content — a sealed candidate is immutable; changed content ships as a NEW candidate id`,
          subject: 'outcome-learning-candidate',
          subjectId: admitted.candidateId,
          publishedDigest: existing.contentDigest,
          encounteredDigest: admitted.contentDigest,
        },
      };
    }
    // The embedded records must be registered history (exact revisions).
    const poolFactDigest = poolFacts.get(admitted.comparisonFact.factId);
    if (poolFactDigest === undefined || poolFactDigest !== admitted.comparisonFact.contentDigest) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `candidate "${admitted.candidateId}" embeds comparison fact "${admitted.comparisonFact.factId}" @ ${admitted.comparisonFact.contentDigest.slice(0, 8)}… which is not registered history — register the source records before assembling`,
          referenceKind: 'comparison-fact',
          referenceId: admitted.comparisonFact.factId,
        },
      };
    }
    const poolOutcomeDigest = poolOutcomes.get(admitted.outcome.recordId);
    if (poolOutcomeDigest === undefined || poolOutcomeDigest !== admitted.outcome.contentDigest) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `candidate "${admitted.candidateId}" embeds outcome record "${admitted.outcome.recordId}" @ ${admitted.outcome.contentDigest.slice(0, 8)}… which is not registered history — register the source records before assembling`,
          referenceKind: 'outcome-record',
          referenceId: admitted.outcome.recordId,
        },
      };
    }
    // The prediction/outcome pair grounds at most one row.
    const pairKey = `${admitted.comparisonFact.forecastRef.recordId}->${admitted.outcome.recordId}`;
    const pairOwner = pairs.get(pairKey);
    if (pairOwner !== undefined) {
      return {
        ok: false,
        error: {
          code: 'history-immutable',
          message: `the (${admitted.comparisonFact.forecastRef.recordId}, ${admitted.outcome.recordId}) pair is already grounded by candidate "${pairOwner}" — the prediction-to-outcome verdict of a pair is immutable; comparison against new outcomes ships as a NEW pair`,
          subject: 'prediction-outcome-pair',
          subjectId: pairKey,
          publishedDigest: verifiedCandidates.get(pairOwner)!.contentDigest,
          encounteredDigest: admitted.contentDigest,
        },
      };
    }
    pairs.set(pairKey, admitted.candidateId);
    verifiedCandidates.set(admitted.candidateId, admitted);
  }

  if (verifiedCandidates.size === 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'a dataset assembly requires at least one distinct candidate',
        issues: [{ path: 'candidates', message: 'all candidates were duplicates' }],
      },
    };
  }

  // 4. Eligibility evaluation + row/exclusion derivation.
  const rows: SealedDatasetRow[] = [];
  const exclusionRecords: SealedExclusionRecord[] = [];
  const inputDigests: string[] = [];
  for (const candidate of verifiedCandidates.values()) {
    inputDigests.push(candidate.contentDigest);
    const evaluation = evaluateEligibility(scope, candidate);
    if (evaluation.state !== 'eligible') {
      const exclusionId = `exclusion:${scopeSlug(candidate.candidateId)}`;
      const sealed = sealExclusionRecord({
        schema: 'epoch.learning-calibration.exclusion-record',
        schemaVersion: LEARNING_CALIBRATION_RECORD_VERSION,
        exclusionId,
        tenantId: scope.tenantId,
        solutionId: scope.solutionId,
        candidateRef: {
          recordId: candidate.candidateId,
          contentDigest: candidate.contentDigest,
        },
        state: evaluation.state,
        reasons: [...evaluation.reasons],
      });
      if (!sealed.ok) {
        return sealed;
      }
      exclusionRecords.push(sealed.value);
      continue;
    }
    const outcome = asOutcomeRecord(candidate.outcome);
    if (!outcome.ok) {
      return outcome;
    }
    const features = deriveErrorVarianceFeatures(
      candidate.comparisonFact.deviation,
      candidate.comparisonFact.bias,
      bandThresholds,
      candidate.varianceEvidence,
    );
    if (!features.ok) {
      return features;
    }
    const pairDigest = canonicalDigest({
      prediction: candidate.comparisonFact.forecastRef.contentDigest,
      outcome: candidate.outcome.contentDigest,
    } as unknown as JsonValue);
    const measureClass = candidate.comparisonFact.forecastMeasure.kind;
    const row = sealDatasetRow({
      schema: DATASET_ROW_SCHEMA_NAME,
      schemaVersion: LEARNING_CALIBRATION_RECORD_VERSION,
      rowId: deriveRowId(
        candidate.comparisonFact.forecastRef.recordId,
        candidate.outcome.recordId,
        pairDigest,
      ),
      tenantId: scope.tenantId,
      solutionId: scope.solutionId,
      subject: candidate.comparisonFact.subject,
      predictionRef: candidate.comparisonFact.forecastRef,
      outcomeRef: {
        recordId: candidate.outcome.recordId,
        contentDigest: candidate.outcome.contentDigest,
      },
      actualRef: candidate.comparisonFact.actualRef,
      comparisonRef: candidate.comparisonFact.comparisonRef,
      measureClass,
      ...(measureClass === 'quantity' && candidate.comparisonFact.forecastMeasure.kind === 'quantity'
        ? { unit: candidate.comparisonFact.forecastMeasure.unit }
        : {}),
      ...(measureClass === 'cost' && candidate.comparisonFact.forecastMeasure.kind === 'cost'
        ? { currency: candidate.comparisonFact.forecastMeasure.currency }
        : {}),
      features: features.value,
      packRef: candidate.packRef,
      realizationVariant: candidate.realizationVariant,
      observedAt: candidate.comparisonFact.observedAt,
      provenance: {
        comparisonFact: {
          recordId: candidate.comparisonFact.factId,
          contentDigest: candidate.comparisonFact.contentDigest,
        },
        outcomeRecord: {
          recordId: candidate.outcome.recordId,
          contentDigest: candidate.outcome.contentDigest,
        },
      },
    });
    if (!row.ok) {
      return row;
    }
    rows.push(row.value);
  }

  // 5. Canonical ordering + sealing.
  rows.sort((a, b) => (a.rowId < b.rowId ? -1 : 1));
  exclusionRecords.sort((a, b) => (a.exclusionId < b.exclusionId ? -1 : 1));
  inputDigests.sort();
  return sealLearningDataset({
    schema: LEARNING_DATASET_SCHEMA_NAME,
    schemaVersion: LEARNING_CALIBRATION_RECORD_VERSION,
    datasetId: deriveDatasetId(scope.solutionId, inputDigests),
    tenantId: scope.tenantId,
    solutionId: scope.solutionId,
    assemblyPolicy: {
      bandThresholds,
      eligibilityRulesetVersion: LEARNING_ELIGIBILITY_RULESET_VERSION,
    },
    rows,
    exclusions: exclusionRecords,
    eligibleCount: rows.length,
    excludedCount: exclusionRecords.length,
    inputDigests,
  });
}

/** The store fold: dataset rows sorted by rowId (deterministic; already canonical). */
export function foldDatasetRows(dataset: SealedLearningDataset): readonly SealedDatasetRow[] {
  return [...dataset.rows].sort((a, b) => (a.rowId < b.rowId ? -1 : 1));
}

/** The store fold: exclusion records sorted by exclusionId (deterministic; already canonical). */
export function foldExclusions(
  dataset: SealedLearningDataset,
): readonly SealedExclusionRecord[] {
  return [...dataset.exclusions].sort((a, b) => (a.exclusionId < b.exclusionId ? -1 : 1));
}
