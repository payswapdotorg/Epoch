/**
 * The OPAQUE TYPED REFERENCES the learning-calibration kernel folds
 * (the W037/W039 opaque-reference discipline): every upstream record
 * arrives as an exact-revision reference (record id + content digest)
 * or as an OPAQUE MIRRORED record shape pinned by compile-time kernel
 * parity (src/kernel-parity.ts) and runtime parity tests
 * (test/parity.test.ts) — @epoch/actualization and @epoch/variance are
 * devDependencies only, NEVER runtime edges.
 *
 * - The COMPARISON-FACT INPUT is a grammar-identical mirror of the
 *   W039 `ComparisonFactContent`/`SealedComparisonFact` (one past
 *   forecast vs one actualized outcome, both measures, the exact
 *   deviation, the forecast-bias direction). Identical content digests
 *   identically (the same canonicalDigest from @epoch/agent-protocol),
 *   so records sealed by the REAL W039 kernel verify here and vice
 *   versa (pinned by tests).
 * - The FORECAST/ACTUAL SIDE references mirror the W039 side-reference
 *   grammars.
 * - The PACK REFERENCE is the DP1.0 domain-pack context by TYPED
 *   REFERENCE to the W036 SolutionPackProfile: qualified pack id,
 *   semantic version, and the exact content digest of that profile
 *   revision. Never an embedded profile copy, never a pack-keyed store.
 * - The VALIDATION-STATE EVIDENCE is an opaque typed record carrying
 *   the W039 validation state of the observation group backing the
 *   actual (plus the exact-revision assessment reference that derived
 *   it).
 * - The VARIANCE EVIDENCE is an opaque typed record carrying the W039
 *   variance classification (class + the exact-revision variance-record
 *   reference + the optional root-cause attribution with its evidence
 *   digests).
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  DistinctionSubjectSchema,
  MeasureSchema,
  SealedDistinctionRecordSchema,
  TenantIdSchema,
  type Measure,
} from '@epoch/solution-delivery';
import {
  LEARNING_FORECAST_BIAS_DIRECTIONS,
  LEARNING_VALIDATION_STATES,
  LEARNING_VARIANCE_CLASSES,
  MIRRORED_COMPARISON_FACT_SCHEMA_NAME,
  LEARNING_CALIBRATION_RECORD_VERSION,
} from './version';
import { NonNegativeDecimalSchema, SemverCoreSchema, Sha256HexSchema, SolutionIdSchema } from './primitives';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { LearningResult } from './errors';

// --------------------------------------------------------------------------------
// The W039 comparison-fact mirror (opaque input — kernel parity).
// --------------------------------------------------------------------------------

/** One exact-revision reference to a variance-kernel prediction-comparison record. */
export const ComparisonRecordReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^comparison:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ComparisonRecordReference',
    title: 'ComparisonRecordReference',
    description:
      'One opaque exact-revision reference to a prediction-comparison record (the W039 variance-kernel grammar): record id plus content digest.',
  });

/** One comparison-record reference. */
export type ComparisonRecordReference = z.infer<typeof ComparisonRecordReferenceSchema>;

/** One exact-revision reference to the compared forecast revision (the W039 grammar). */
export const ForecastSideReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ForecastSideReference',
    title: 'ForecastSideReference',
    description:
      'One exact-revision reference to the W036 Forecast-distinction record a comparison fact judged.',
  });

/** One forecast-side reference (the PREDICTION reference of a dataset row). */
export type ForecastSideReference = z.infer<typeof ForecastSideReferenceSchema>;

/** One exact-revision reference to the actualized outcome (the W039 grammar). */
export const ActualSideReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ActualSideReference',
    title: 'ActualSideReference',
    description:
      'One exact-revision reference to the W036 Actual-distinction record a comparison fact judged against.',
  });

/** One actual-side reference. */
export type ActualSideReference = z.infer<typeof ActualSideReferenceSchema>;

/**
 * The immutable content of one comparison-fact INPUT — the
 * grammar-identical mirror of the W039 `ComparisonFactContent`: one
 * past forecast versus one actualized outcome, with both measures, the
 * exact deviation magnitude, and the forecast-bias direction. Facts
 * produced by the REAL W039 variance/actualization kernels seal and
 * verify identically here (runtime parity test).
 */
const comparisonFactInputShape = z.strictObject({
  schema: z.literal(MIRRORED_COMPARISON_FACT_SCHEMA_NAME),
  schemaVersion: z.literal(LEARNING_CALIBRATION_RECORD_VERSION),
  factId: z.string().regex(/^comparison-fact:[a-z0-9][a-z0-9-]{0,62}$/),
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  subject: DistinctionSubjectSchema,
  comparisonRef: ComparisonRecordReferenceSchema,
  forecastRef: ForecastSideReferenceSchema,
  actualRef: ActualSideReferenceSchema,
  forecastMeasure: MeasureSchema,
  actualMeasure: MeasureSchema,
  deviation: NonNegativeDecimalSchema,
  bias: z.enum(LEARNING_FORECAST_BIAS_DIRECTIONS),
  observedAt: TimestampSchema,
});

export const ComparisonFactInputSchema = comparisonFactInputShape
  .readonly()
  .superRefine((fact, ctx) => {
    if (fact.forecastMeasure.kind !== fact.actualMeasure.kind) {
      ctx.addIssue({
        code: 'custom',
        message: 'the forecast and actual measures of one comparison fact share one measure kind',
        path: ['actualMeasure'],
      });
    }
    if (fact.forecastMeasure.kind === 'quantity' && fact.actualMeasure.kind === 'quantity') {
      if (fact.forecastMeasure.unit !== fact.actualMeasure.unit) {
        ctx.addIssue({
          code: 'custom',
          message: 'the forecast and actual measures of one comparison fact share one unit',
          path: ['actualMeasure'],
        });
      }
    }
    if (fact.forecastMeasure.kind === 'cost' && fact.actualMeasure.kind === 'cost') {
      if (fact.forecastMeasure.currency !== fact.actualMeasure.currency) {
        ctx.addIssue({
          code: 'custom',
          message: 'the forecast and actual measures of one comparison fact share one currency',
          path: ['actualMeasure'],
        });
      }
    }
    if (fact.forecastRef.recordId === fact.actualRef.recordId) {
      ctx.addIssue({
        code: 'custom',
        message: 'a comparison fact compares two distinct records',
        path: ['actualRef'],
      });
    }
  })
  .meta({
    id: 'ComparisonFactInput',
    title: 'ComparisonFactInput',
    description:
      'The immutable content of one comparison-fact input (the W039 comparison-fact grammar, mirrored): the comparison-record reference, the compared forecast and actual exact revisions with their measures, the exact deviation magnitude, and the forecast-bias direction.',
  });

/** One comparison-fact input content. */
export type ComparisonFactInput = z.infer<typeof ComparisonFactInputSchema>;

/** The SEALED comparison-fact input: content plus its SHA-256 content digest. */
export const SealedComparisonFactInputSchema = z
  .strictObject({
    ...comparisonFactInputShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedComparisonFactInput',
    title: 'SealedComparisonFactInput',
    description:
      'The sealed comparison-fact input: immutable W039-grammar content plus its SHA-256 content digest (identical to the W039 sealed record for the same content).',
  });

/** One sealed comparison-fact input. */
export type SealedComparisonFactInput = z.infer<typeof SealedComparisonFactInputSchema>;

/** Compute the content digest of a comparison-fact input (canonical JSON). */
export function computeComparisonFactInputDigest(content: ComparisonFactInput): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid comparison-fact input content into its published record. */
export function sealComparisonFactInput(
  content: unknown,
): LearningResult<SealedComparisonFactInput> {
  const parsed = ComparisonFactInputSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed comparison-fact input (schema + digest recomputation). */
export function verifySealedComparisonFactInput(
  sealed: unknown,
): LearningResult<SealedComparisonFactInput> {
  const parsed = SealedComparisonFactInputSchema.safeParse(sealed);
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
          'sealed comparison-fact input digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The domain-pack context reference (DP1.0 — typed reference, never a store).
// --------------------------------------------------------------------------------

/**
 * One typed reference to the W036 SolutionPackProfile: the qualified
 * pack id, the pack version, and the exact content digest of that
 * profile revision. Learning rows carry domain-pack context by THIS
 * reference — pack-scoped learning surfaces are PURE PROJECTIONS over
 * the universal dataset (never pack-keyed history stores).
 */
export const PackReferenceSchema = z
  .strictObject({
    packId: z.string().regex(/^[a-z0-9]+(?:\.[a-z0-9-]+)+$/),
    packVersion: SemverCoreSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'PackReference',
    title: 'PackReference',
    description:
      'One typed exact-revision reference to a W036 SolutionPackProfile: qualified pack id, semantic version, and the content digest of that profile revision.',
  });

/** One pack reference. */
export type PackReference = z.infer<typeof PackReferenceSchema>;

// --------------------------------------------------------------------------------
// The validation-state evidence (W039 states, opaque typed record).
// --------------------------------------------------------------------------------

/**
 * One opaque typed validation-state evidence: the W039 validation state
 * of the observation group backing the actual side of a comparison,
 * plus the exact-revision reference to the W039 validation assessment
 * that derived the state. `corroborated`/`resolved` groups fold
 * validated actuals; `conflicting` groups are still unresolved;
 * `insufficient` groups never validated.
 */
export const ValidationStateEvidenceSchema = z
  .strictObject({
    state: z.enum(LEARNING_VALIDATION_STATES),
    assessmentRef: z
      .strictObject({
        recordId: z.string().regex(/^validation:[a-z0-9][a-z0-9-]{0,62}$/),
        contentDigest: Sha256HexSchema,
      })
      .readonly(),
  })
  .readonly()
  .meta({
    id: 'ValidationStateEvidence',
    title: 'ValidationStateEvidence',
    description:
      'One opaque typed validation-state evidence: the W039 validation state of the observation group backing the actual side (insufficient/corroborated/conflicting/resolved) plus the exact-revision assessment reference that derived it.',
  });

/** One validation-state evidence. */
export type ValidationStateEvidence = z.infer<typeof ValidationStateEvidenceSchema>;

// --------------------------------------------------------------------------------
// The variance evidence (W039 variance classification, opaque typed record).
// --------------------------------------------------------------------------------

/**
 * One opaque typed root-cause attribution — the W039 cause grammar:
 * change-record / issue-record / external-condition, each an opaque
 * record id plus the exact content digest, with the MANDATORY sorted
 * W006-convention evidence digests (attribution without evidence is
 * inexpressible — the W039 pin).
 */
export const LearningCauseRefSchema = z
  .discriminatedUnion('causeKind', [
    z
      .strictObject({
        causeKind: z.literal('change-record'),
        recordId: z
          .string()
          .regex(
            /^change:[a-z0-9][a-z0-9-]{0,62}$/,
            'a change-record cause reference carries a W038 change id ("change:<slug>")',
          ),
        contentDigest: Sha256HexSchema,
      })
      .readonly(),
    z
      .strictObject({
        causeKind: z.literal('issue-record'),
        recordId: z
          .string()
          .regex(
            /^(change|delay|rework|defect|blocker):[a-z0-9][a-z0-9-]{0,62}$/,
            'an issue-record cause reference carries a W038 issue id ("change:|delay:|rework:|defect:|blocker:<slug>")',
          ),
        contentDigest: Sha256HexSchema,
      })
      .readonly(),
    z
      .strictObject({
        causeKind: z.literal('external-condition'),
        recordId: z.string().min(1).max(256),
        contentDigest: Sha256HexSchema,
      })
      .readonly(),
  ])
  .meta({
    id: 'LearningCauseRef',
    title: 'LearningCauseRef',
    description:
      'One opaque typed root-cause attribution (the W039 cause grammar): cause kind, opaque record id, exact content digest, and the mandatory sorted evidence digests.',
  });

/** One cause reference (the W039 grammar, mirrored). */
export type LearningCauseRef = z.infer<typeof LearningCauseRefSchema>;

/**
 * One opaque typed variance evidence: the W039 variance CLASS of the
 * compared deviation, the exact-revision reference to the W039
 * variance record that classified it, and the optional evidence-grounded
 * root-cause attribution.
 */
export const VarianceEvidenceSchema = z
  .strictObject({
    varianceClass: z.enum(LEARNING_VARIANCE_CLASSES),
    varianceRecordRef: z
      .strictObject({
        recordId: z.string().regex(/^variance:[a-z0-9][a-z0-9-]{0,62}$/),
        contentDigest: Sha256HexSchema,
      })
      .readonly(),
    attribution: z
      .strictObject({
        cause: LearningCauseRefSchema,
        evidence: z.array(Sha256HexSchema).min(1).max(64),
      })
      .readonly()
      .nullable(),
  })
  .readonly()
  .meta({
    id: 'VarianceEvidence',
    title: 'VarianceEvidence',
    description:
      'One opaque typed variance evidence: the W039 variance class of the compared deviation, the exact-revision variance-record reference, and the optional evidence-grounded root-cause attribution.',
  });

/** One variance evidence. */
export type VarianceEvidence = z.infer<typeof VarianceEvidenceSchema>;

// --------------------------------------------------------------------------------
// The W036 outcome record (genuine runtime composition — the same objects).
// --------------------------------------------------------------------------------

/**
 * The sealed W036 Outcome-distinction record slot: the composed W036
 * distinction-union schema narrowed (by refinement) to kind `outcome`
 * — the outcome reference evidence the eligibility fold reads
 * (outcomeKind, subject, tenant). Genuine runtime composition; the
 * outcome records themselves are READ-ONLY history (history-immutable
 * — no write path exists in this kernel). The refinement guarantees
 * kind === "outcome" at runtime; the static type is narrowed to match
 * (the Extract view of the union).
 */
export const OutcomeRecordSlotSchema = SealedDistinctionRecordSchema.superRefine(
  (record, ctx) => {
    if (record.kind !== 'outcome') {
      ctx.addIssue({
        code: 'custom',
        message: 'the outcome slot carries a W036 Outcome-distinction record (kind "outcome")',
        path: ['kind'],
      });
    }
  },
) as unknown as z.ZodType<SealedOutcomeRecord>;

/** The sealed W036 OUTCOME record (the kind-narrowed view of the W036 union). */
export type SealedOutcomeRecord = Extract<
  z.infer<typeof SealedDistinctionRecordSchema>,
  { kind: 'outcome' }
>;

/** One exact-revision reference to a W036 Outcome-distinction record. */
export const OutcomeRecordReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^outcome:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'OutcomeRecordReference',
    title: 'OutcomeRecordReference',
    description:
      'One exact-revision reference to a W036 Outcome-distinction record: record id plus content digest.',
  });

/** One outcome-record reference. */
export type OutcomeRecordReference = z.infer<typeof OutcomeRecordReferenceSchema>;

/** The measure value string of one side of a comparison (exact decimal). */
export function measureValueOf(measure: Measure): string {
  switch (measure.kind) {
    case 'quantity':
      return measure.value;
    case 'cost':
      return measure.amount;
    case 'progress':
      // Fixed-point bridge (never float math).
      return measure.fraction.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
    case 'instant':
      return String(Date.parse(measure.at));
  }
}
