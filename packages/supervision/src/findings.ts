/**
 * The supervision FINDING record: one typed, content-addressed
 * observation produced by a pure check over sealed inputs.
 *
 * - A finding is a FACT of one evaluation pass: due / late / drifted /
 *   blocked — the status vocabulary is closed, and the record carries
 *   the typed measures the check observed (never mutations);
 * - findings are READ-ONLY over delivery state: no field expresses an
 *   intent to change the program, the delivery or any gate;
 * - content addressing: the content digest is the SHA-256 of the
 *   canonical JSON of everything except the digest itself; identical
 *   inputs always produce identical digests (replay-safe);
 * - finding ids are DERIVED deterministically from (class, subjectKind,
 *   subjectId) so the same subject re-evaluated across passes keeps a
 *   stable identity (the alerts kernel's idempotency key).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  DeliveryIdSchema,
  GateIdSchema,
  MilestoneIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  ProgramIdSchema,
  ProgressFractionSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
} from '@epoch/solution-delivery';
import { ActivityIdMirrorSchema } from './primitives';
import {
  ANOMALY_BREACH_CLASSES,
  FINDING_CLASSES,
  FINDING_SUBJECT_KINDS,
  FINDING_STATUSES,
  SUPERVISION_FINDING_SCHEMA_NAME,
  SUPERVISION_RECORD_VERSION,
  type FindingClass,
} from './version';
import { FindingProvenanceSchema } from './provenance';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { SupervisionResult } from './errors';

// --------------------------------------------------------------------------------
// The typed measures a finding may carry (class-relevant, all optional,
// all bounded — the check families set only what they observed).
// --------------------------------------------------------------------------------

/** One closed freshness-state observation (the W036 grammar, mirrored). */
const FreshnessStateMirrorSchema = z.enum(['fresh', 'aging', 'stale']);

/** The typed measures of one supervision finding. */
export const FindingMeasuresSchema = z
  .strictObject({
    plannedStart: TimestampSchema.optional(),
    plannedFinish: TimestampSchema.optional(),
    actualStart: TimestampSchema.optional(),
    actualFinish: TimestampSchema.optional(),
    forecastFinish: TimestampSchema.optional(),
    actualProgress: ProgressFractionSchema.optional(),
    targetDate: TimestampSchema.optional(),
    daysLate: NonNegativeDecimalSchema.optional(),
    driftDays: NonNegativeDecimalSchema.optional(),
    shortfallDays: NonNegativeDecimalSchema.optional(),
    plannedValue: NonNegativeDecimalSchema.optional(),
    actualValue: NonNegativeDecimalSchema.optional(),
    thresholdValue: NonNegativeDecimalSchema.optional(),
    varianceValue: z
      .string()
      .regex(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/)
      .optional(),
    unit: UnitLabelSchema.optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    breachClass: z.enum(ANOMALY_BREACH_CLASSES).optional(),
    impactedActivityIds: z.array(ActivityIdMirrorSchema).max(64).optional(),
    missingPrerequisiteIds: z.array(ActivityIdMirrorSchema).max(64).optional(),
    blockerRefs: z.array(OpaqueReferenceSchema).max(64).optional(),
    issueRecordIds: z.array(z.string().min(1).max(128)).max(64).optional(),
    gateId: GateIdSchema.optional(),
    gatePassed: z.boolean().optional(),
    acquisitionRef: OpaqueReferenceSchema.optional(),
    requiredBy: TimestampSchema.optional(),
    realisticLeadTimeDays: NonNegativeDecimalSchema.optional(),
    infoRequestId: z.string().min(1).max(128).optional(),
    freshnessState: FreshnessStateMirrorSchema.optional(),
  })
  .readonly()
  .superRefine((measures, ctx) => {
    for (const field of ['impactedActivityIds', 'missingPrerequisiteIds'] as const) {
      const values = measures[field];
      if (values === undefined) continue;
      for (let i = 1; i < values.length; i += 1) {
        if (values[i]! < values[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be sorted ascending (deterministic serialization)`,
            path: [field],
          });
          break;
        }
      }
    }
    for (const field of ['blockerRefs', 'issueRecordIds'] as const) {
      const values = measures[field];
      if (values === undefined) continue;
      for (let i = 1; i < values.length; i += 1) {
        if (values[i]! < values[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be sorted ascending (deterministic serialization)`,
            path: [field],
          });
          break;
        }
        if (values[i]! === values[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be duplicate-free`,
            path: [field],
          });
          break;
        }
      }
    }
  })
  .meta({
    id: 'FindingMeasures',
    title: 'FindingMeasures',
    description:
      'The typed measures one supervision finding observed: schedule dates, progress, day magnitudes, consumption/cost values with breach class, and the opaque reference lists the check folded.',
  });

/** One finding measures block. */
export type FindingMeasures = z.infer<typeof FindingMeasuresSchema>;

// --------------------------------------------------------------------------------
// The finding record.
// --------------------------------------------------------------------------------

/** The subject of one finding: a typed anchor inside the supervised program. */
export const FindingSubjectSchema = z
  .strictObject({
    subjectKind: z.enum(FINDING_SUBJECT_KINDS),
    subjectId: z.string().min(1).max(256),
  })
  .readonly()
  .meta({
    id: 'FindingSubject',
    title: 'FindingSubject',
    description: 'The subject of one supervision finding: a closed subject kind plus the opaque id inside the supervised program.',
  });

/** One finding subject. */
export type FindingSubject = z.infer<typeof FindingSubjectSchema>;

/** The immutable content of one supervision finding (everything except the digest). */
export const SupervisionFindingContentSchema = z
  .strictObject({
    schema: z.literal(SUPERVISION_FINDING_SCHEMA_NAME),
    schemaVersion: z.literal(SUPERVISION_RECORD_VERSION),
    findingId: z.string().regex(/^finding:[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    programId: ProgramIdSchema,
    deliveryId: DeliveryIdSchema,
    findingClass: z.enum(FINDING_CLASSES),
    status: z.enum(FINDING_STATUSES),
    subject: FindingSubjectSchema,
    title: z.string().min(1).max(256),
    detail: z.string().min(1).max(2048),
    measures: FindingMeasuresSchema,
    provenance: FindingProvenanceSchema,
    milestoneId: MilestoneIdSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'SupervisionFindingContent',
    title: 'SupervisionFindingContent',
    description:
      'The immutable content of one supervision finding: identity, tenant scope, class, status, subject, title/detail, typed measures, and W006-convention provenance.',
  });

/** One finding content. */
export type SupervisionFindingContent = z.infer<typeof SupervisionFindingContentSchema>;

/** The SEALED supervision finding: content plus its SHA-256 content digest. */
export const SealedSupervisionFindingSchema = z
  .strictObject({
    schema: z.literal(SUPERVISION_FINDING_SCHEMA_NAME),
    schemaVersion: z.literal(SUPERVISION_RECORD_VERSION),
    findingId: z.string().regex(/^finding:[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    programId: ProgramIdSchema,
    deliveryId: DeliveryIdSchema,
    findingClass: z.enum(FINDING_CLASSES),
    status: z.enum(FINDING_STATUSES),
    subject: FindingSubjectSchema,
    title: z.string().min(1).max(256),
    detail: z.string().min(1).max(2048),
    measures: FindingMeasuresSchema,
    provenance: FindingProvenanceSchema,
    milestoneId: MilestoneIdSchema.optional(),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedSupervisionFinding',
    title: 'SealedSupervisionFinding',
    description:
      'The sealed supervision finding: immutable typed observation content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed supervision finding. */
export type SealedSupervisionFinding = z.infer<typeof SealedSupervisionFindingSchema>;

/** Compute the content digest of a finding content. */
export function computeSupervisionFindingDigest(content: SupervisionFindingContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid finding content into its published record. */
export function sealSupervisionFinding(content: unknown): SupervisionResult<SealedSupervisionFinding> {
  const parsed = SupervisionFindingContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeSupervisionFindingDigest(parsed.data) },
  };
}

/**
 * Verify a sealed finding: schema validation + digest recomputation
 * (tamper detection — `digest-mismatch`).
 */
export function verifySealedSupervisionFinding(sealed: unknown): SupervisionResult<SealedSupervisionFinding> {
  const parsed = SealedSupervisionFindingSchema.safeParse(sealed);
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
        message: 'sealed supervision finding digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: parsed.data.findingId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Deterministic finding-id derivation.
// --------------------------------------------------------------------------------

/**
 * Derive the stable finding id from (class, subjectKind, subjectId):
 * `finding:<kebab slug>`, hashed down to a digest-derived suffix when
 * the composed slug does not fit the 63-char tail budget. Deterministic:
 * the same subject always derives the same id across passes (the alerts
 * idempotency key).
 */
export function deriveFindingId(
  findingClass: FindingClass,
  subject: FindingSubject,
): string {
  const raw = `${findingClass}-${subject.subjectKind}-${subject.subjectId}`;
  let slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length > 62) {
    slug = slug.slice(0, 62);
  }
  if (slug.length >= 1 && slug.length <= 62) {
    return `finding:${slug}`;
  }
  // Unreachable in practice (every class/subject pair slugs to >=1 char);
  // kept total: digest-derived fallback.
  return `finding:${canonicalDigest(raw as unknown as JsonValue).slice(0, 40)}`;
}
