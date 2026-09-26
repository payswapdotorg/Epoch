/**
 * The nine SEMANTIC DISTINCTION record types (USL1.0, binding):
 * Prediction, Estimate, Baseline, Commitment, Observation, Actual,
 * Forecast, Outcome, Learning Record.
 *
 * These are SEPARATE concepts. Every record is an immutable, digest-sealed
 * member of ONE kind for its entire lifetime:
 *
 * - `sealDistinctionRecord` / `verifySealedDistinctionRecord` give every
 *   record exact-revision content addressing (SHA-256 over canonical
 *   JSON; tamper detection is a typed `digest-mismatch`);
 * - the record id is kind-prefixed (`prediction:<slug>`,
 *   `observation:<slug>`, ...) and the prefix MUST match the `kind` — one
 *   record identity belongs to exactly one distinction;
 * - the {@link DistinctionLedger} admission rejects a record id that
 *   changes kind (`distinction-collapse-rejected` — collapsing the
 *   distinctions into one mutable value) and immutable-content
 *   re-admission conflicts (`version-conflict`);
 * - FORECASTS NEVER OVERWRITE historical predictions, baselines or
 *   actuals: a forecast may `refines` an EARLIER FORECAST only —
 *   refining any other record is a typed `forecast-overwrite-rejected`;
 * - every record carries the full uncertainty state (provenance +
 *   freshness + confidence — the decision-sufficiency rule).
 *
 * A BASELINE record REFERENCES the sealed solution version (the solution
 * version chain is the baseline authority — a baseline distinction record
 * is the delivery-domain pointer onto it, never a second ledger).
 */
import { z } from 'zod';
import {
  canonicalDigest,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import {
  AcquisitionIdSchema,
  CurrencyCodeSchema,
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  ProgressFractionSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  UnitLabelSchema,
} from './primitives';
import { TenantIdSchema } from '@epoch/tenancy';
import { EvidenceReferenceSchema } from './solution';
import { UncertaintyStateSchema } from './uncertainty';
import {
  DISTINCTION_RECORD_SCHEMA_NAME,
  OUTCOME_KINDS,
  SOLUTION_DELIVERY_RECORD_VERSION,
  kindPrefixOf,
  type SemanticDistinctionKind,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { DeliveryResult } from './errors';

// --------------------------------------------------------------------------------
// The measure space: what a distinction record states, in provider-neutral
// units (quantity, cost, instant, progress).
// --------------------------------------------------------------------------------

/** A quantity measure: canonical decimal value plus a unit label. */
export const QuantityMeasureSchema = z
  .strictObject({
    kind: z.literal('quantity'),
    value: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
  })
  .readonly()
  .meta({
    id: 'QuantityMeasure',
    title: 'QuantityMeasure',
    description: 'A quantity measure: canonical decimal value plus a unit-of-measure label.',
  });

/** A cost measure: canonical decimal amount plus an ISO 4217 currency. */
export const CostMeasureSchema = z
  .strictObject({
    kind: z.literal('cost'),
    amount: NonNegativeDecimalSchema,
    currency: CurrencyCodeSchema,
  })
  .readonly()
  .meta({
    id: 'CostMeasure',
    title: 'CostMeasure',
    description: 'A cost measure: canonical decimal amount plus an ISO 4217 currency code.',
  });

/** An instant measure: a point in time (planned/forecast/actual dates). */
export const InstantMeasureSchema = z
  .strictObject({
    kind: z.literal('instant'),
    at: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'InstantMeasure',
    title: 'InstantMeasure',
    description: 'An instant measure: a point in time in the canonical UTC form.',
  });

/** A progress measure: a 0..1 completion fraction. */
export const ProgressMeasureSchema = z
  .strictObject({
    kind: z.literal('progress'),
    fraction: ProgressFractionSchema,
  })
  .readonly()
  .meta({
    id: 'ProgressMeasure',
    title: 'ProgressMeasure',
    description: 'A progress measure: a completion fraction between 0 and 1.',
  });

/** One provider-neutral measure. */
export const MeasureSchema = z
  .discriminatedUnion('kind', [
    QuantityMeasureSchema,
    CostMeasureSchema,
    InstantMeasureSchema,
    ProgressMeasureSchema,
  ])
  .meta({
    id: 'Measure',
    title: 'Measure',
    description:
      'One provider-neutral measure: quantity (value+unit), cost (amount+currency), instant, or progress (0..1 fraction).',
  });

/** One measure. */
export type Measure = z.infer<typeof MeasureSchema>;

/** One quantity measure. */
export type QuantityMeasure = z.infer<typeof QuantityMeasureSchema>;

/** One cost measure. */
export type CostMeasure = z.infer<typeof CostMeasureSchema>;

/** One instant measure. */
export type InstantMeasure = z.infer<typeof InstantMeasureSchema>;

/** One progress measure. */
export type ProgressMeasure = z.infer<typeof ProgressMeasureSchema>;

// --------------------------------------------------------------------------------
// The subject: what a distinction record is about (identity-preserving
// navigation anchors on these identities — never on embedded objects).
// --------------------------------------------------------------------------------

/** The subject kinds a distinction record may attach to. */
export const DISTINCTION_SUBJECT_KINDS = [
  'solution',
  'solution-line',
  'work-package',
  'activity',
  'milestone',
  'program',
  'delivery',
] as const;

/** One distinction subject kind. */
export type DistinctionSubjectKind = (typeof DISTINCTION_SUBJECT_KINDS)[number];

/** The subject of one distinction record: solution context + typed anchor. */
export const DistinctionSubjectSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    subjectKind: z.enum(DISTINCTION_SUBJECT_KINDS),
    subjectId: z.string().min(1).max(256),
  })
  .readonly()
  .meta({
    id: 'DistinctionSubject',
    title: 'DistinctionSubject',
    description:
      'The subject of one distinction record: the owning solution plus a typed anchor (solution, line, work package, activity, milestone, program, or delivery id).',
  });

/** One distinction subject. */
export type DistinctionSubject = z.infer<typeof DistinctionSubjectSchema>;

// --------------------------------------------------------------------------------
// The nine kind-specific payloads.
// --------------------------------------------------------------------------------

/** Prediction payload: a forward-looking measure from a model or method. */
export const PredictionPayloadSchema = z
  .strictObject({
    basisRef: OpaqueReferenceSchema.optional(),
    predictedFor: TimestampSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'PredictionPayload',
    title: 'PredictionPayload',
    description:
      'Prediction payload: optional opaque basis reference (e.g. a simulation run) and optional target instant.',
  });

/** One prediction payload. */
export type PredictionPayload = z.infer<typeof PredictionPayloadSchema>;

/** Estimate payload: a measure with an estimation method and range. */
export const EstimatePayloadSchema = z
  .strictObject({
    method: OpaqueReferenceSchema.optional(),
    range: z
      .strictObject({
        low: NonNegativeDecimalSchema,
        high: NonNegativeDecimalSchema,
      })
      .refine((range) => Number(range.low) <= Number(range.high), 'range low must not exceed high')
      .readonly()
      .optional(),
  })
  .readonly()
  .meta({
    id: 'EstimatePayload',
    title: 'EstimatePayload',
    description:
      'Estimate payload: optional opaque estimation-method reference and optional low/high range in the measure unit.',
  });

/** One estimate payload. */
export type EstimatePayload = z.infer<typeof EstimatePayloadSchema>;

/**
 * Baseline payload: the approved solution version reference (exact digest).
 * The solution version chain is the baseline authority; this record is the
 * delivery-domain pointer onto it.
 */
export const BaselinePayloadSchema = z
  .strictObject({
    solutionVersion: SemverCoreSchema,
    solutionVersionDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'BaselinePayload',
    title: 'BaselinePayload',
    description:
      'Baseline payload: the approved solution version and its exact content digest (the version chain is the authority).',
  });

/** One baseline payload. */
export type BaselinePayload = z.infer<typeof BaselinePayloadSchema>;

/**
 * Commitment payload: what a named party committed to (quantity, cost, or
 * date), optionally tied to an acquisition request.
 */
export const CommitmentPayloadSchema = z
  .strictObject({
    committedBy: PrincipalIdSchema,
    committedAt: TimestampSchema,
    acquisitionId: AcquisitionIdSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'CommitmentPayload',
    title: 'CommitmentPayload',
    description:
      'Commitment payload: the committing principal, the commitment instant, and an optional acquisition-request link.',
  });

/** One commitment payload. */
export type CommitmentPayload = z.infer<typeof CommitmentPayloadSchema>;

/** Sorted/duplicate-free refinement shared by digest-keyed arrays. */
function refineSortedDigests(
  digests: readonly { readonly digest: string }[],
  ctx: z.RefinementCtx,
  path: string,
): void {
  for (let i = 1; i < digests.length; i += 1) {
    if (digests[i]!.digest < digests[i - 1]!.digest) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be sorted by digest ascending (deterministic serialization)`,
        path: [path],
      });
      break;
    }
    if (digests[i]!.digest === digests[i - 1]!.digest) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be duplicate-free by digest`,
        path: [path],
      });
      break;
    }
  }
}

/**
 * Observation payload: evidence capture (USL1.0: Observation is evidence
 * capture; Actualization converts ACCEPTED observations only — the
 * acceptance machinery lives on the DeliveryRecord).
 */
export const ObservationPayloadSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    observedAt: TimestampSchema,
    observedBy: PrincipalIdSchema,
    evidence: z.array(EvidenceReferenceSchema).max(64),
  })
  .readonly()
  .superRefine((payload, ctx) => refineSortedDigests(payload.evidence, ctx, 'evidence'))
  .meta({
    id: 'ObservationPayload',
    title: 'ObservationPayload',
    description:
      'Observation payload: the delivery record it belongs to, the observation instant and observer, and the sorted evidence references.',
  });

/** One observation payload. */
export type ObservationPayload = z.infer<typeof ObservationPayloadSchema>;

/**
 * Actual payload: an authoritative delivery fact converted from an
 * ACCEPTED observation (the derivation link is mandatory).
 */
export const ActualPayloadSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    derivedFromObservationId: DistinctionRecordIdSchema,
    actualizedAt: TimestampSchema,
    actualizedBy: PrincipalIdSchema,
  })
  .readonly()
  .meta({
    id: 'ActualPayload',
    title: 'ActualPayload',
    description:
      'Actual payload: the delivery record, the observation this actual was converted from, and the actualization instant and principal.',
  });

/** One actual payload. */
export type ActualPayload = z.infer<typeof ActualPayloadSchema>;

/**
 * Forecast payload: a projection of remaining work from the latest
 * validated delivery state. `refines` may reference an EARLIER FORECAST
 * only — forecasts refine forecasts; they NEVER overwrite historical
 * predictions, baselines or actuals (typed
 * `forecast-overwrite-rejected` at ledger admission).
 */
export const ForecastPayloadSchema = z
  .strictObject({
    asOf: TimestampSchema,
    refines: DistinctionRecordIdSchema.nullable(),
  })
  .readonly()
  .meta({
    id: 'ForecastPayload',
    title: 'ForecastPayload',
    description:
      'Forecast payload: the as-of instant of the validated delivery state it projects, and the earlier forecast it refines (forecast lineage only; never a prediction/baseline/actual).',
  });

/** One forecast payload. */
export type ForecastPayload = z.infer<typeof ForecastPayloadSchema>;

/** Outcome payload: the final outcome state of a delivered subject. */
export const OutcomePayloadSchema = z
  .strictObject({
    outcomeKind: z.enum(OUTCOME_KINDS),
    verificationRefs: z.array(Sha256HexSchema).max(64),
    note: z.string().max(2048).optional(),
  })
  .readonly()
  .superRefine((payload, ctx) => {
    for (let i = 1; i < payload.verificationRefs.length; i += 1) {
      if (payload.verificationRefs[i]! < payload.verificationRefs[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'verificationRefs must be sorted ascending (deterministic serialization)',
          path: ['verificationRefs'],
        });
        break;
      }
      if (payload.verificationRefs[i]! === payload.verificationRefs[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'verificationRefs must be duplicate-free',
          path: ['verificationRefs'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'OutcomePayload',
    title: 'OutcomePayload',
    description:
      'Outcome payload: the outcome kind, sorted verification references, and an optional note.',
  });

/** One outcome payload. */
export type OutcomePayload = z.infer<typeof OutcomePayloadSchema>;

/** Sorted/duplicate-free refinement for plain string arrays. */
function refineSortedStrings(
  values: readonly string[],
  ctx: z.RefinementCtx,
  path: string,
): void {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]! < values[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be sorted ascending (deterministic serialization)`,
        path: [path],
      });
      break;
    }
    if (values[i]! === values[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be duplicate-free`,
        path: [path],
      });
      break;
    }
  }
}

/**
 * Learning payload: the USL1.0 Learn link
 * `context + solution + acquisition + realization + observations + actuals -> outcome`
 * — carried as typed record links plus the lesson text.
 */
export const LearningPayloadSchema = z
  .strictObject({
    lesson: z.string().min(1).max(4096),
    links: z.array(DistinctionRecordIdSchema).max(64),
  })
  .readonly()
  .superRefine((payload, ctx) => refineSortedStrings(payload.links, ctx, 'links'))
  .meta({
    id: 'LearningPayload',
    title: 'LearningPayload',
    description:
      'Learning payload: the lesson text and the sorted record links (context, solution, actuals, outcome).',
  });

/** One learning payload. */
export type LearningPayload = z.infer<typeof LearningPayloadSchema>;

// --------------------------------------------------------------------------------
// The distinction record family: common envelope + kind-specific fields.
// --------------------------------------------------------------------------------

/** The shared envelope shape of every distinction record content option. */
function distinctionEnvelope() {
  return {
    schema: z.literal(DISTINCTION_RECORD_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    recordId: DistinctionRecordIdSchema,
    tenantId: TenantIdSchema,
    subject: DistinctionSubjectSchema,
    recordedAt: TimestampSchema,
    recordedBy: PrincipalIdSchema,
    uncertainty: UncertaintyStateSchema,
  } as const;
}

/** The nine content options (kind discriminator + optional measure + payload). */
const PREDICTION_CONTENT = z.strictObject({
  ...distinctionEnvelope(),
  kind: z.literal('prediction'),
  measure: MeasureSchema,
  payload: PredictionPayloadSchema,
});
const ESTIMATE_CONTENT = z.strictObject({
  ...distinctionEnvelope(),
  kind: z.literal('estimate'),
  measure: MeasureSchema,
  payload: EstimatePayloadSchema,
});
const BASELINE_CONTENT = z.strictObject({
  ...distinctionEnvelope(),
  kind: z.literal('baseline'),
  payload: BaselinePayloadSchema,
});
const COMMITMENT_CONTENT = z.strictObject({
  ...distinctionEnvelope(),
  kind: z.literal('commitment'),
  measure: MeasureSchema,
  payload: CommitmentPayloadSchema,
});
const OBSERVATION_CONTENT = z.strictObject({
  ...distinctionEnvelope(),
  kind: z.literal('observation'),
  measure: MeasureSchema,
  payload: ObservationPayloadSchema,
});
const ACTUAL_CONTENT = z.strictObject({
  ...distinctionEnvelope(),
  kind: z.literal('actual'),
  measure: MeasureSchema,
  payload: ActualPayloadSchema,
});
const FORECAST_CONTENT = z.strictObject({
  ...distinctionEnvelope(),
  kind: z.literal('forecast'),
  measure: MeasureSchema,
  payload: ForecastPayloadSchema,
});
const OUTCOME_CONTENT = z.strictObject({
  ...distinctionEnvelope(),
  kind: z.literal('outcome'),
  payload: OutcomePayloadSchema,
});
const LEARNING_CONTENT = z.strictObject({
  ...distinctionEnvelope(),
  kind: z.literal('learning'),
  payload: LearningPayloadSchema,
});

const DISTINCTION_CONTENT_OPTIONS = [
  PREDICTION_CONTENT,
  ESTIMATE_CONTENT,
  BASELINE_CONTENT,
  COMMITMENT_CONTENT,
  OBSERVATION_CONTENT,
  ACTUAL_CONTENT,
  FORECAST_CONTENT,
  OUTCOME_CONTENT,
  LEARNING_CONTENT,
] as const;

/** The record-id/kind prefix consistency check (enforced at LEDGER admission). */
function recordIdPrefixMatchesKind(record: { kind: string; recordId: string }): boolean {
  return kindPrefixOf(record.recordId) === record.kind;
}

/**
 * The immutable content of one semantic-distinction record (everything
 * except the content digest). The kind selects the measure/payload shape:
 * predictions, estimates, commitments, observations, actuals and forecasts
 * carry a MEASURE; baselines reference the solution version; outcomes and
 * learnings carry their own payloads.
 */
export const DistinctionRecordContentSchema = z
  .discriminatedUnion('kind', [...DISTINCTION_CONTENT_OPTIONS])
  .readonly()
  .meta({
    id: 'DistinctionRecordContent',
    title: 'DistinctionRecordContent',
    description:
      'The immutable content of one semantic-distinction record: kind discriminator, kind-prefixed record id, tenant scope, subject, measure (where applicable), kind-specific payload, recording provenance, and the mandatory uncertainty state.',
  });

/** One distinction record content. */
export type DistinctionRecordContent = z.infer<typeof DistinctionRecordContentSchema>;

/** The nine sealed options (content shape + the content digest). */
const DISTINCTION_SEALED_OPTIONS = [
  z.strictObject({ ...PREDICTION_CONTENT.shape, contentDigest: Sha256HexSchema }),
  z.strictObject({ ...ESTIMATE_CONTENT.shape, contentDigest: Sha256HexSchema }),
  z.strictObject({ ...BASELINE_CONTENT.shape, contentDigest: Sha256HexSchema }),
  z.strictObject({ ...COMMITMENT_CONTENT.shape, contentDigest: Sha256HexSchema }),
  z.strictObject({ ...OBSERVATION_CONTENT.shape, contentDigest: Sha256HexSchema }),
  z.strictObject({ ...ACTUAL_CONTENT.shape, contentDigest: Sha256HexSchema }),
  z.strictObject({ ...FORECAST_CONTENT.shape, contentDigest: Sha256HexSchema }),
  z.strictObject({ ...OUTCOME_CONTENT.shape, contentDigest: Sha256HexSchema }),
  z.strictObject({ ...LEARNING_CONTENT.shape, contentDigest: Sha256HexSchema }),
] as const;

/** The sealed OBSERVATION record (kind `observation`, digest-bearing). */
export const ObservationRecordSchema = z
  .strictObject({ ...OBSERVATION_CONTENT.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'ObservationRecord',
    title: 'ObservationRecord',
    description:
      'The sealed observation record: immutable evidence-capture content (delivery scope, subject, measure, evidence, uncertainty) plus its SHA-256 content digest.',
  });

/** One sealed observation record. */
export type ObservationRecord = z.infer<typeof ObservationRecordSchema>;

/** The sealed ACTUAL record (kind `actual`, digest-bearing). */
export const ActualRecordSchema = z
  .strictObject({ ...ACTUAL_CONTENT.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'ActualRecord',
    title: 'ActualRecord',
    description:
      'The sealed actual record: immutable authoritative delivery fact (derived from an accepted observation) plus its SHA-256 content digest.',
  });

/** One sealed actual record. */
export type ActualRecord = z.infer<typeof ActualRecordSchema>;

/**
 * The SEALED semantic-distinction record: content plus its SHA-256 digest
 * over the canonical JSON of the content (the digest field excluded).
 */
export const SealedDistinctionRecordSchema = z
  .discriminatedUnion('kind', [...DISTINCTION_SEALED_OPTIONS])
  .readonly()
  .meta({
    id: 'SealedDistinctionRecord',
    title: 'SealedDistinctionRecord',
    description:
      'The sealed semantic-distinction record: immutable kind-discriminated content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed distinction record. */
export type SealedDistinctionRecord = z.infer<typeof SealedDistinctionRecordSchema>;

/**
 * Compute the content digest of a distinction record: the SHA-256 of the
 * canonical JSON of the content. Throws on invalid content; producers
 * validate first (`sealDistinctionRecord` is the total form).
 */
export function computeDistinctionRecordDigest(content: DistinctionRecordContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid distinction-record content into its published record. */
export function sealDistinctionRecord(content: unknown): DeliveryResult<SealedDistinctionRecord> {
  const parsed = DistinctionRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/**
 * Verify a sealed distinction record: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedDistinctionRecord(
  sealed: unknown,
): DeliveryResult<SealedDistinctionRecord> {
  const parsed = SealedDistinctionRecordSchema.safeParse(sealed);
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
          'sealed distinction record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The append-only DistinctionLedger (reference in-memory machinery).
// --------------------------------------------------------------------------------

/** The state of one distinction ledger after admissions. */
export interface DistinctionLedger {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly records: readonly SealedDistinctionRecord[];
}

/**
 * Admit a sealed distinction record into the ledger (append-only):
 *
 * - the record verifies (tamper detection);
 * - the record's tenant and solution must match the ledger
 *   (`cross-tenant-denied` / `validation`);
 * - an EXACT re-admission (same id, same digest) is idempotent;
 * - the same id with different content and the SAME kind is a typed
 *   `version-conflict` (a sealed record is immutable);
 * - the same id with a DIFFERENT kind is a typed
 *   `distinction-collapse-rejected` — one record identity cannot change
 *   its semantic distinction (collapsing the distinctions into one
 *   mutable value);
 * - a FORECAST whose `refines` targets anything but an existing forecast
 *   record is a typed `forecast-overwrite-rejected` (forecasts refine
 *   forecasts only; they never overwrite historical predictions,
 *   baselines or actuals).
 */
export function admitDistinctionRecord(
  ledger: DistinctionLedger,
  record: unknown,
): DeliveryResult<DistinctionLedger> {
  const verified = verifySealedDistinctionRecord(record);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== ledger.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `distinction record "${admitted.recordId}" belongs to tenant "${admitted.tenantId}" but the ledger is scoped to "${ledger.tenantId}" (R12 multi-tenant isolation)`,
        expectedTenantId: ledger.tenantId,
        encounteredTenantId: admitted.tenantId,
      },
    };
  }
  if (admitted.subject.solutionId !== ledger.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `distinction record "${admitted.recordId}" subjects solution "${admitted.subject.solutionId}" but the ledger is scoped to "${ledger.solutionId}"`,
        issues: [{ path: 'subject.solutionId', message: 'ledger input mixes solutions' }],
      },
    };
  }
  const existing = ledger.records.find((record) => record.recordId === admitted.recordId);
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: ledger };
    }
    if (existing.kind !== admitted.kind) {
      return {
        ok: false,
        error: {
          code: 'distinction-collapse-rejected',
          message:
            `record id "${admitted.recordId}" is already a "${existing.kind}" record; admitting it as an "${admitted.kind}" ` +
            'collapses the semantic distinctions into one mutable value — each distinction is a separate immutable record (USL1.0)',
          recordId: admitted.recordId,
          publishedKind: existing.kind,
          encounteredKind: admitted.kind,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message:
          `record id "${admitted.recordId}" is already sealed with different content — a sealed distinction record is immutable; ` +
          'changed content ships as a NEW record id',
        solutionId: admitted.subject.solutionId,
        version: admitted.recordId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  if (!recordIdPrefixMatchesKind(admitted)) {
    return {
      ok: false,
      error: {
        code: 'distinction-collapse-rejected',
        message:
          `record id "${admitted.recordId}" is prefixed for the "${kindPrefixOf(admitted.recordId)}" distinction but carries kind "${admitted.kind}" — ` +
          'one record identity cannot serve two semantic distinctions (USL1.0: the distinctions are separate immutable records)',
        recordId: admitted.recordId,
        publishedKind: kindPrefixOf(admitted.recordId) as SemanticDistinctionKind,
        encounteredKind: admitted.kind,
      },
    };
  }
  if (admitted.kind === 'forecast' && admitted.payload.refines !== null) {
    const target = ledger.records.find((record) => record.recordId === admitted.payload.refines);
    if (target === undefined) {
      return {
        ok: false,
        error: {
          code: 'forecast-overwrite-rejected',
          message:
            `forecast "${admitted.recordId}" refines "${admitted.payload.refines}", which does not exist in the ledger — ` +
            'forecasts refine EARLIER FORECASTS only; they never overwrite historical predictions, baselines or actuals',
          forecastRecordId: admitted.recordId,
          refinesRecordId: admitted.payload.refines,
          refinesKind: 'missing',
        },
      };
    }
    if (target.kind !== 'forecast') {
      return {
        ok: false,
        error: {
          code: 'forecast-overwrite-rejected',
          message:
            `forecast "${admitted.recordId}" refines "${target.recordId}", a "${target.kind}" record — ` +
            'forecasts refine EARLIER FORECASTS only; they never overwrite historical predictions, baselines or actuals (USL1.0)',
          forecastRecordId: admitted.recordId,
          refinesRecordId: target.recordId,
          refinesKind: target.kind,
        },
      };
    }
  }
  return { ok: true, value: { ...ledger, records: [...ledger.records, admitted] } };
}

/**
 * Deterministic projection of a ledger: records grouped by semantic
 * distinction kind, each group sorted by record id. Input order is
 * irrelevant (the fold never depends on admission order).
 */
export function foldDistinctionRecords(
  ledger: DistinctionLedger,
): Readonly<Record<SemanticDistinctionKind, readonly SealedDistinctionRecord[]>> {
  const folded = {
    prediction: [],
    estimate: [],
    baseline: [],
    commitment: [],
    observation: [],
    actual: [],
    forecast: [],
    outcome: [],
    learning: [],
  } as Record<SemanticDistinctionKind, SealedDistinctionRecord[]>;
  for (const record of [...ledger.records].sort((a, b) => (a.recordId < b.recordId ? -1 : 1))) {
    folded[record.kind].push(record);
  }
  return folded;
}
