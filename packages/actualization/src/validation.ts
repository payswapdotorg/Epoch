/**
 * ACTUALIZATION RULES AND TYPED VALIDATION STATES (the W039 pin):
 * reconcile MULTIPLE realization observations (W038 usage observations,
 * W037 supplier-delivery receipts — both arrive as W036
 * Observation-distinction records) into VALIDATED ACTUALS.
 *
 * - OBSERVATION INTAKE (`intakeObservation`): sealed W036 observation
 *   records are admitted into the actualization store — verified through
 *   the REAL W036 machinery (digest recomputation, tamper detection),
 *   tenant/delivery scoped, append-only. An EXACT re-admission (same id,
 *   same digest) is the idempotent `duplicate-observation` admission
 *   returning the prior record; the same id with different content is a
 *   typed `version-conflict`. A record of ANY OTHER KIND (an `actual`
 *   record — the bypass attempt) is a typed
 *   `actualization-bypass-rejected`: actuals are minted by the W036
 *   authority path alone.
 * - VALIDATION ASSESSMENT (`assessValidation`): the DETERMINISTIC FOLD
 *   over the store's observations, grouped by (subject, measure kind,
 *   unit/currency). Per group the fold computes the folded measure
 *   (quantity/cost: exact decimal SUM — accumulating partials; progress/
 *   instant: the LATEST observation by observedAt with recordId
 *   tie-break), the maximum pairwise deviation magnitude, and the TYPED
 *   validation state under the reconciliation policy (quorum + exact or
 *   tolerance agreement): `insufficient` / `corroborated` /
 *   `conflicting`. The assessment is a SEALED record (content-addressed);
 *   identical stores + policies derive identical assessment ids and
 *   digests (pure derivation, never stored — the W037 foldSupplierDelivery
 *   precedent).
 * - CONFLICT RESOLUTION (`sealConflictResolution` + store admission): a
 *   typed, sealed record partitioning one conflicting assessment's
 *   observation set into the SELECTED subset (folds into the validated
 *   actual) and the EXCLUDED subset. The resolution binds the EXACT
 *   assessment revision (id + digest); a stale assessment revision is a
 *   typed `dangling-reference-rejected`. The group's effective state
 *   becomes `resolved`.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  DeliveryIdSchema,
  DistinctionSubjectSchema,
  MeasureSchema,
  ObservationRecordSchema,
  SolutionIdSchema,
  TenantIdSchema,
  verifySealedDistinctionRecord,
  type Measure,
  type ObservationRecord,
} from '@epoch/solution-delivery';
import {
  ObservationReferenceSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  TimestampSchema,
  AssessmentReferenceSchema,
  ValidationAssessmentIdSchema,
  ConflictResolutionIdSchema,
  type ObservationReference,
} from './primitives';
import {
  ACTUALIZATION_RECORD_VERSION,
  CONFLICT_RESOLUTION_SCHEMA_NAME,
  RECONCILIATION_FOLD_MODES,
  RECONCILIATION_MODES,
  VALIDATION_ASSESSMENT_SCHEMA_NAME,
  VALIDATION_STATES,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import {
  addNonNegativeDecimals as addDecimal,
  compareNonNegativeDecimals,
  decimalFromFraction,
  subtractNonNegativeDecimals,
} from './decimal';
import type { ActualizationResult } from './errors';

// --------------------------------------------------------------------------------
// The reconciliation policy.
// --------------------------------------------------------------------------------

/**
 * The reconciliation policy: how observation agreement is measured per
 * group. `quorum` is the minimum observation count for corroboration
 * (default 1 — a single accepted observation is valid evidence; higher
 * quorums demand repeated independent capture).
 */
export const ReconciliationPolicySchema = z
  .strictObject({
    mode: z.enum(RECONCILIATION_MODES),
    foldMode: z.enum(RECONCILIATION_FOLD_MODES).optional(),
    tolerance: z
      .string()
      .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/, 'must be a canonical non-negative decimal')
      .optional(),
    quorum: PositiveIntegerSchema.optional(),
  })
  .readonly()
  .superRefine((policy, ctx) => {
    if (policy.mode === 'tolerance' && policy.tolerance === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a tolerance-mode policy must carry its tolerance decimal',
        path: ['tolerance'],
      });
    }
    if (policy.mode === 'exact' && policy.tolerance !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'an exact-mode policy carries no tolerance',
        path: ['tolerance'],
      });
    }
  })
  .meta({
    id: 'ReconciliationPolicy',
    title: 'ReconciliationPolicy',
    description:
      'The reconciliation policy of one validation fold: exact or tolerance agreement mode, the fold mode (accumulate increments vs snapshot repeat-measurements; progress/instant groups always fold as snapshots), optional tolerance decimal (group unit/currency; milliseconds for instants), and the optional corroboration quorum.',
  });

/** One reconciliation policy. */
export type ReconciliationPolicy = z.infer<typeof ReconciliationPolicySchema>;

/** The default corroboration quorum (1: a single accepted observation is valid evidence). */
export const DEFAULT_RECONCILIATION_QUORUM = 1 as const;

// --------------------------------------------------------------------------------
// The validation-assessment record.
// --------------------------------------------------------------------------------

/** The measure kinds a validation group folds (the W036 measure kinds). */
export const VALIDATION_MEASURE_KINDS = ['quantity', 'cost', 'progress', 'instant'] as const;

/** One validation measure kind. */
export type ValidationMeasureKind = (typeof VALIDATION_MEASURE_KINDS)[number];

/**
 * The immutable content of one validation assessment: the DERIVED
 * deterministic fold over one observation group under one policy. Pure
 * data — no provenance instants (the fold is a function of the store;
 * provenance lives in the actualization:* events).
 */
const validationAssessmentShape = z.strictObject({
  schema: z.literal(VALIDATION_ASSESSMENT_SCHEMA_NAME),
  schemaVersion: z.literal(ACTUALIZATION_RECORD_VERSION),
  assessmentId: ValidationAssessmentIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  deliveryId: DeliveryIdSchema,
  subject: DistinctionSubjectSchema,
  measureKind: z.enum(VALIDATION_MEASURE_KINDS),
  unit: z.string().min(1).max(32).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  policy: ReconciliationPolicySchema,
  observationRefs: z.array(ObservationReferenceSchema).min(1).max(4096),
  state: z.enum(['insufficient', 'corroborated', 'conflicting']),
  foldedMeasure: MeasureSchema,
  deviationMagnitude: z
    .string()
    .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
});

export const ValidationAssessmentContentSchema = validationAssessmentShape
  .readonly()
  .superRefine((assessment, ctx) => {
    for (let i = 1; i < assessment.observationRefs.length; i += 1) {
      if (assessment.observationRefs[i]!.recordId < assessment.observationRefs[i - 1]!.recordId) {
        ctx.addIssue({
          code: 'custom',
          message:
            'observationRefs must be sorted by recordId ascending (deterministic serialization)',
          path: ['observationRefs'],
        });
        break;
      }
      if (assessment.observationRefs[i]!.recordId === assessment.observationRefs[i - 1]!.recordId) {
        ctx.addIssue({
          code: 'custom',
          message: 'observationRefs must be duplicate-free by recordId',
          path: ['observationRefs'],
        });
        break;
      }
    }
    if (assessment.measureKind === 'quantity' && assessment.unit === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a quantity-folded assessment carries its unit',
        path: ['unit'],
      });
    }
    if (assessment.measureKind === 'cost' && assessment.currency === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a cost-folded assessment carries its currency',
        path: ['currency'],
      });
    }
    if (assessment.foldedMeasure.kind !== assessment.measureKind) {
      ctx.addIssue({
        code: 'custom',
        message: 'the folded measure kind must match the group measure kind',
        path: ['foldedMeasure'],
      });
    }
  })
  .meta({
    id: 'ValidationAssessmentContent',
    title: 'ValidationAssessmentContent',
    description:
      'The immutable content of one validation assessment: the deterministic fold of one observation group under a reconciliation policy — group anchor, policy, sorted exact-revision observation references, the typed validation state, the folded measure, and the maximum pairwise deviation magnitude.',
  });

/** One validation-assessment content. */
export type ValidationAssessmentContent = z.infer<typeof ValidationAssessmentContentSchema>;

/** The SEALED validation assessment: content plus its SHA-256 content digest. */
export const SealedValidationAssessmentSchema = z
  .strictObject({
    ...validationAssessmentShape.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedValidationAssessment',
    title: 'SealedValidationAssessment',
    description:
      'The sealed validation assessment: immutable fold content plus its SHA-256 content digest (exact-revision addressing of the derived assessment).',
  });

/** One sealed validation assessment. */
export type SealedValidationAssessment = z.infer<typeof SealedValidationAssessmentSchema>;

/** Compute the content digest of a validation-assessment content (canonical JSON). */
export function computeValidationAssessmentDigest(
  content: ValidationAssessmentContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid validation-assessment content into its published record. */
export function sealValidationAssessment(
  content: unknown,
): ActualizationResult<SealedValidationAssessment> {
  const parsed = ValidationAssessmentContentSchema.safeParse(content);
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
 * Verify a sealed validation assessment: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedValidationAssessment(
  sealed: unknown,
): ActualizationResult<SealedValidationAssessment> {
  const parsed = SealedValidationAssessmentSchema.safeParse(sealed);
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
          'sealed validation assessment digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The conflict-resolution record.
// --------------------------------------------------------------------------------

/**
 * The immutable content of one conflict resolution: the typed decision
 * that partitions one CONFLICTING assessment's observation set into the
 * SELECTED subset (the one that folds into the validated actual) and the
 * EXCLUDED subset — bound to the EXACT assessment revision.
 */
const conflictResolutionShape = z.strictObject({
  schema: z.literal(CONFLICT_RESOLUTION_SCHEMA_NAME),
  schemaVersion: z.literal(ACTUALIZATION_RECORD_VERSION),
  resolutionId: ConflictResolutionIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  deliveryId: DeliveryIdSchema,
  assessmentRef: AssessmentReferenceSchema,
  selectedObservationRefs: z.array(ObservationReferenceSchema).min(1).max(4096),
  excludedObservationRefs: z.array(ObservationReferenceSchema).max(4096),
  resolvedBy: PrincipalIdSchema,
  resolvedAt: TimestampSchema,
  rationale: z.string().max(2048).optional(),
});

export const ConflictResolutionContentSchema = conflictResolutionShape
  .readonly()
  .superRefine((resolution, ctx) => {
    for (const [field, refs] of [
      ['selectedObservationRefs', resolution.selectedObservationRefs],
      ['excludedObservationRefs', resolution.excludedObservationRefs],
    ] as const) {
      for (let i = 1; i < refs.length; i += 1) {
        if (refs[i]!.recordId < refs[i - 1]!.recordId) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be sorted by recordId ascending (deterministic serialization)`,
            path: [field],
          });
          break;
        }
        if (refs[i]!.recordId === refs[i - 1]!.recordId) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be duplicate-free by recordId`,
            path: [field],
          });
          break;
        }
      }
    }
    const selected = new Set(resolution.selectedObservationRefs.map((ref) => ref.recordId));
    for (const excluded of resolution.excludedObservationRefs) {
      if (selected.has(excluded.recordId)) {
        ctx.addIssue({
          code: 'custom',
          message: `observation "${excluded.recordId}" is both selected and excluded`,
          path: ['excludedObservationRefs'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ConflictResolutionContent',
    title: 'ConflictResolutionContent',
    description:
      'The immutable content of one conflict resolution: the exact assessment revision it resolves, the sorted selected observation subset (folds into the validated actual), the sorted excluded subset, and the resolution provenance.',
  });

/** One conflict-resolution content. */
export type ConflictResolutionContent = z.infer<typeof ConflictResolutionContentSchema>;

/** The SEALED conflict resolution: content plus its SHA-256 content digest. */
export const SealedConflictResolutionSchema = z
  .strictObject({
    ...conflictResolutionShape.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedConflictResolution',
    title: 'SealedConflictResolution',
    description:
      'The sealed conflict resolution: immutable resolution content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed conflict resolution. */
export type SealedConflictResolution = z.infer<typeof SealedConflictResolutionSchema>;

/** Compute the content digest of a conflict-resolution content (canonical JSON). */
export function computeConflictResolutionDigest(
  content: ConflictResolutionContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid conflict-resolution content into its published record. */
export function sealConflictResolution(
  content: unknown,
): ActualizationResult<SealedConflictResolution> {
  const parsed = ConflictResolutionContentSchema.safeParse(content);
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
 * Verify a sealed conflict resolution: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedConflictResolution(
  sealed: unknown,
): ActualizationResult<SealedConflictResolution> {
  const parsed = SealedConflictResolutionSchema.safeParse(sealed);
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
          'sealed conflict resolution digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The observation intake (the actualization-store admission).
// --------------------------------------------------------------------------------

/** The typed outcome of one observation intake. */
export type ObservationIntakeOutcome =
  | {
      readonly kind: 'recorded';
      readonly record: ObservationRecord;
    }
  | {
      /** The idempotent duplicate admission: the sealed PRIOR record. */
      readonly kind: 'duplicate-observation';
      readonly record: ObservationRecord;
    };

/**
 * The observation-intake input (the store half lives in src/store.ts;
 * this pure validator admits one sealed W036 record into an observation
 * list — the shared engine of both the kernel store admission and the
 * service port intake).
 */
export function admitObservationRecord(
  scope: { readonly tenantId: string; readonly solutionId: string; readonly deliveryId: string },
  existing: readonly ObservationRecord[],
  record: unknown,
): ActualizationResult<{ readonly observations: readonly ObservationRecord[]; readonly admission: ObservationIntakeOutcome }> {
  const verified = verifySealedDistinctionRecord(record);
  if (!verified.ok) {
    // A distinction record that fails W036 verification (including a
    // non-distinction payload or a tampered digest) surfaces through the
    // adapter — EXCEPT the bypass pre-classification below.
    const asRecord = record as { kind?: unknown; recordId?: unknown } | null | undefined;
    if (
      asRecord !== null &&
      typeof asRecord === 'object' &&
      typeof asRecord.kind === 'string' &&
      asRecord.kind !== 'observation'
    ) {
      return {
        ok: false,
        error: {
          code: 'actualization-bypass-rejected',
          message:
            `record "${String(asRecord.recordId)}" is of kind "${asRecord.kind}" — the actualization intake carries OBSERVATION records only; ` +
            'actuals are minted by the W036 DeliveryRecord authority path (recordObservation -> acceptObservation -> actualizeObservation), ' +
            'never admitted directly',
          recordId: String(asRecord.recordId),
          recordKind: asRecord.kind,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the actualization intake carries sealed W036 Observation-distinction records only',
        issues: [{ path: '$', message: verified.error.message }],
      },
    };
  }
  const admitted = verified.value;
  if (admitted.kind !== 'observation') {
    return {
      ok: false,
      error: {
        code: 'actualization-bypass-rejected',
        message:
          `record "${admitted.recordId}" is of kind "${admitted.kind}" — the actualization intake carries OBSERVATION records only; ` +
          'actuals are minted by the W036 DeliveryRecord authority path (recordObservation -> acceptObservation -> actualizeObservation), ' +
          'never admitted directly (the W038 precedent)',
        recordId: admitted.recordId,
        recordKind: admitted.kind,
      },
    };
  }
  const observation = ObservationRecordSchema.parse(admitted);
  if (observation.tenantId !== scope.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `observation "${observation.recordId}" belongs to tenant "${observation.tenantId}" but the actualization store is scoped to "${scope.tenantId}" (R12)`,
        expectedTenantId: scope.tenantId,
        encounteredTenantId: observation.tenantId,
        subject: observation.recordId,
      },
    };
  }
  if (observation.subject.solutionId !== scope.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `observation "${observation.recordId}" subjects solution "${observation.subject.solutionId}" but the store is scoped to "${scope.solutionId}"`,
        issues: [{ path: 'subject.solutionId', message: 'observation/store solution mismatch' }],
      },
    };
  }
  if (observation.payload.deliveryId !== scope.deliveryId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `observation "${observation.recordId}" belongs to delivery "${observation.payload.deliveryId}" but the store is scoped to "${scope.deliveryId}"`,
        issues: [{ path: 'payload.deliveryId', message: 'observation/store delivery mismatch' }],
      },
    };
  }
  const prior = existing.find((candidate) => candidate.recordId === observation.recordId);
  if (prior !== undefined) {
    if (prior.contentDigest === observation.contentDigest) {
      return {
        ok: true,
        value: { observations: existing, admission: { kind: 'duplicate-observation', record: prior } },
      };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `observation "${observation.recordId}" is already intaken with different content — observations are append-only and immutable; changed content ships as a NEW observation id`,
        subject: 'observation',
        subjectId: observation.recordId,
        publishedDigest: prior.contentDigest,
        encounteredDigest: observation.contentDigest,
      },
    };
  }
  const observations = [...existing, observation].sort((a, b) =>
    a.recordId < b.recordId ? -1 : 1,
  );
  return {
    ok: true,
    value: { observations, admission: { kind: 'recorded', record: observation } },
  };
}

// --------------------------------------------------------------------------------
// The deterministic validation fold.
// --------------------------------------------------------------------------------

/** One observation group of the fold (the grouping key + its records). */
interface ObservationGroup {
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly measureKind: ValidationMeasureKind;
  readonly unit: string | undefined;
  readonly currency: string | undefined;
  readonly observations: readonly ObservationRecord[];
}

/** The canonical group key of one observation (never leaks intake order). */
function groupKeyOf(observation: ObservationRecord): string {
  const unit = observation.measure.kind === 'quantity' ? observation.measure.unit : '';
  const currency = observation.measure.kind === 'cost' ? observation.measure.currency : '';
  return [
    observation.subject.subjectKind,
    observation.subject.subjectId,
    observation.measure.kind,
    unit,
    currency,
  ].join('\u0000');
}

/** The canonical measure value of one observation as a decimal string. */
function measureValueOf(measure: Measure): string {
  switch (measure.kind) {
    case 'quantity':
      return measure.value;
    case 'cost':
      return measure.amount;
    case 'progress':
      return decimalFromFraction(measure.fraction);
    case 'instant':
      return String(Date.parse(measure.at));
  }
}

/**
 * Deterministically derive the assessment id of one group fold:
 * `validation:<subject>-<measure-kind>-<digest-prefix>` where the digest
 * prefix is the first 8 hex characters of the canonical digest of the
 * sorted observation-reference set — identical observation sets derive
 * identical assessment ids (replay idempotence), new observations derive
 * new ids.
 */
function deriveAssessmentId(group: ObservationGroup, refs: readonly ObservationReference[]): string {
  const subjectSlug = `${group.subjectKind}-${group.subjectId}`
    .replace(/:/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const setDigest = canonicalDigest(
    refs.map((ref) => ({ recordId: ref.recordId, contentDigest: ref.contentDigest })) as unknown as JsonValue,
  );
  return `validation:${subjectSlug}-${group.measureKind}-${setDigest.slice(0, 8)}`;
}

/** The maximum pairwise deviation of a value set (exact decimal). */
function maxPairwiseDeviation(values: readonly string[]): string {
  let max = '0';
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      const difference = subtractNonNegativeDecimals(values[i]!, values[j]!);
      if (compareNonNegativeDecimals(difference.magnitude, max) > 0) {
        max = difference.magnitude;
      }
    }
  }
  return max;
}

/** Whether one group folds under the accumulate semantics (increments). */
function foldsAsAccumulate(group: ObservationGroup, policy: ReconciliationPolicy): boolean {
  if (group.measureKind === 'progress' || group.measureKind === 'instant') {
    // Snapshot measures ALWAYS fold as snapshots (latest capture wins;
    // progression across instants is not conflict).
    return false;
  }
  return (policy.foldMode ?? 'accumulate') === 'accumulate';
}

/** The latest observation of a group by (observedAt, recordId) — deterministic. */
function latestObservation(group: ObservationGroup): ObservationRecord {
  return [...group.observations].sort((a, b) => {
    const byInstant =
      a.payload.observedAt < b.payload.observedAt
        ? -1
        : a.payload.observedAt > b.payload.observedAt
          ? 1
          : 0;
    if (byInstant !== 0) return byInstant;
    return a.recordId < b.recordId ? -1 : 1;
  })[group.observations.length - 1]!;
}

/** Fold one group's measure (the validated-actual candidate). */
function foldGroupMeasure(group: ObservationGroup, policy: ReconciliationPolicy): Measure {
  if (foldsAsAccumulate(group, policy)) {
    // Accumulating increments (partial deliveries / usage consumption —
    // the W037 receipt pattern): the exact decimal SUM (commutative —
    // input order never leaks).
    let total = '0';
    for (const observation of group.observations) {
      total = addDecimal(total, measureValueOf(observation.measure));
    }
    return group.measureKind === 'quantity'
      ? { kind: 'quantity', value: total, unit: group.unit! }
      : { kind: 'cost', amount: total, currency: group.currency! };
  }
  // Snapshot semantics (repeat measurements / progress / instants): the
  // LATEST observation by observedAt, recordId tie-break — deterministic.
  return latestObservation(group).measure;
}

/**
 * The deviation magnitude of one group under its fold semantics:
 * - accumulate: increments never conflict — the deviation is '0';
 * - snapshot quantity/cost: the maximum pairwise deviation over ALL
 *   captures (repeat measurements must agree);
 * - snapshot progress/instant: the maximum pairwise deviation among
 *   SIMULTANEOUS captures only (progression across instants is not
 *   conflict).
 */
function groupDeviationMagnitude(group: ObservationGroup, policy: ReconciliationPolicy): string {
  if (foldsAsAccumulate(group, policy)) {
    return '0';
  }
  if (group.measureKind === 'progress' || group.measureKind === 'instant') {
    const byInstant = new Map<string, string[]>();
    for (const observation of group.observations) {
      const instant = observation.payload.observedAt;
      const value = measureValueOf(observation.measure);
      byInstant.set(instant, [...(byInstant.get(instant) ?? []), value]);
    }
    let max = '0';
    for (const values of byInstant.values()) {
      const deviation = maxPairwiseDeviation(values);
      if (compareNonNegativeDecimals(deviation, max) > 0) {
        max = deviation;
      }
    }
    return max;
  }
  return maxPairwiseDeviation(group.observations.map((observation) => measureValueOf(observation.measure)));
}

/**
 * Assess the validation state of every observation group of a store's
 * observation list: the DETERMINISTIC FOLD (see the module doc). Groups
 * with zero observations do not exist; every returned assessment is
 * sealed; the returned list sorts by assessmentId (input order never
 * leaks).
 */
export function assessValidation(
  scope: { readonly tenantId: string; readonly solutionId: string; readonly deliveryId: string },
  observations: readonly ObservationRecord[],
  policy: ReconciliationPolicy,
): ActualizationResult<readonly SealedValidationAssessment[]> {
  const parsedPolicy = ReconciliationPolicySchema.safeParse(policy);
  if (!parsedPolicy.success) {
    return { ok: false, error: validationError(parsedPolicy.error) };
  }
  const groups = new Map<string, ObservationGroup>();
  for (const observation of observations) {
    const key = groupKeyOf(observation);
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        subjectKind: observation.subject.subjectKind,
        subjectId: observation.subject.subjectId,
        measureKind: observation.measure.kind,
        unit: observation.measure.kind === 'quantity' ? observation.measure.unit : undefined,
        currency: observation.measure.kind === 'cost' ? observation.measure.currency : undefined,
        observations: [observation],
      });
    } else {
      groups.set(key, { ...existing, observations: [...existing.observations, observation] });
    }
  }
  const quorum = policy.quorum ?? DEFAULT_RECONCILIATION_QUORUM;
  const assessments: SealedValidationAssessment[] = [];
  for (const group of [...groups.values()].sort((a, b) =>
    groupKeyString(a) < groupKeyString(b) ? -1 : 1,
  )) {
    const refs = [...group.observations]
      .sort((a, b) => (a.recordId < b.recordId ? -1 : 1))
      .map((observation) => ({
        recordId: observation.recordId,
        contentDigest: observation.contentDigest,
      }));
    const deviation = groupDeviationMagnitude(group, parsedPolicy.data);
    let state: 'insufficient' | 'corroborated' | 'conflicting';
    if (group.observations.length < quorum) {
      state = 'insufficient';
    } else if (agreesUnderPolicy(deviation, parsedPolicy.data)) {
      state = 'corroborated';
    } else {
      state = 'conflicting';
    }
    const content = {
      schema: VALIDATION_ASSESSMENT_SCHEMA_NAME,
      schemaVersion: ACTUALIZATION_RECORD_VERSION,
      assessmentId: deriveAssessmentId(group, refs),
      tenantId: scope.tenantId,
      solutionId: scope.solutionId,
      deliveryId: scope.deliveryId,
      subject: {
        solutionId: scope.solutionId,
        subjectKind: group.subjectKind,
        subjectId: group.subjectId,
      },
      measureKind: group.measureKind,
      ...(group.unit !== undefined ? { unit: group.unit } : {}),
      ...(group.currency !== undefined ? { currency: group.currency } : {}),
      policy: parsedPolicy.data,
      observationRefs: refs,
      state,
      foldedMeasure: foldGroupMeasure(group, parsedPolicy.data),
      deviationMagnitude: deviation,
    };
    const sealed = sealValidationAssessment(content);
    if (!sealed.ok) {
      return sealed;
    }
    assessments.push(sealed.value);
  }
  return { ok: true, value: assessments.sort((a, b) => (a.assessmentId < b.assessmentId ? -1 : 1)) };
}

/** The sortable canonical key of one group. */
function groupKeyString(group: ObservationGroup): string {
  return [group.subjectKind, group.subjectId, group.measureKind, group.unit ?? '', group.currency ?? ''].join('\u0000');
}

/** Whether a deviation magnitude satisfies the policy's agreement mode. */
function agreesUnderPolicy(deviation: string, policy: ReconciliationPolicy): boolean {
  if (policy.mode === 'exact') {
    return compareNonNegativeDecimals(deviation, '0') === 0;
  }
  return compareNonNegativeDecimals(deviation, policy.tolerance ?? '0') <= 0;
}

// --------------------------------------------------------------------------------
// The effective group state (assessment + optional resolution).
// --------------------------------------------------------------------------------

/** The effective typed state of one group: the assessment state, or `resolved`. */
export function effectiveGroupState(
  assessment: SealedValidationAssessment,
  resolutions: readonly SealedConflictResolution[],
): ValidationStateFromAssessment {
  const bound = resolutions.find(
    (resolution) =>
      resolution.assessmentRef.assessmentId === assessment.assessmentId &&
      resolution.assessmentRef.contentDigest === assessment.contentDigest,
  );
  if (bound !== undefined) {
    return 'resolved';
  }
  return assessment.state;
}

/** The effective validation state of a group (assessment or resolved). */
export type ValidationStateFromAssessment = (typeof VALIDATION_STATES)[number];
