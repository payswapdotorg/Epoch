/**
 * @epoch/mobile — typed capture envelopes (Work Order W018 Tech Lead pin:
 * "the channel a real native client would carry — versioned,
 * content-addressed, replay-safe").
 *
 * A capture envelope is the low-friction field-observation channel:
 *
 * - VERSIONED (`MOBILE_FIELD_RECORD_VERSION` — exact pin, skew is a typed
 *   `version-mismatch`);
 * - CONTENT-ADDRESSED (sealed with the canonical SHA-256 digest over the
 *   canonical JSON of the content; tamper detection is a typed
 *   `digest-mismatch`);
 * - REPLAY-SAFE (immutable content; the same content always seals to the
 *   same digest, which is the offline queue's idempotency key);
 * - W036-SHAPED: the payload is an Observation-distinction record CONTENT
 *   (quantity/progress measure, subject, payload, MANDATORY uncertainty
 *   state) — produced against the @epoch/solution-delivery validators so
 *   `toObservationRecord` converts the envelope into a W036
 *   `ObservationRecord` the DeliveryRecord intake accepts verbatim;
 * - EVIDENCE BY DIGEST ONLY: photo/sensor/note references in the W006
 *   convention (never embedded payloads — typed `evidence-payload-rejected`);
 * - UNAMBIGUOUS LINKAGE: work-package linkage by OPAQUE id. An ambiguous
 *   link (unresolved candidates) is a typed `ambiguous-linkage-rejected` —
 *   never a guess.
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  WorkPackageIdSchema,
  MeasureSchema,
  DistinctionSubjectSchema,
  ObservationPayloadSchema,
  ObservationRecordSchema,
  UncertaintyStateSchema,
  SOLUTION_DELIVERY_RECORD_VERSION,
  sealDistinctionRecord,
  type Measure,
  type ObservationRecord,
  type SealedDistinctionRecord,
  type UncertaintyState,
} from '@epoch/solution-delivery';
import {
  crossTenantDeniedError,
  digestMismatchError,
  fieldError,
  fieldOk,
  fieldValidationError,
  flattenZodIssues,
  hasUnrecognizedKeys,
  vendorFieldsError,
  type MobileFieldResult,
} from './errors';
import { FieldCaptureIdSchema, FieldSessionIdSchema } from './primitives';
import { MOBILE_FIELD_RECORD_VERSION } from './version';
import { FieldEvidenceRefArraySchema, admitFieldEvidenceRef, type FieldEvidenceRef } from './evidence';

/**
 * The W036 distinction-record schema literal (kernel-internal constant,
 * carried here verbatim; pinned BEHAVIORALLY by the sync round-trip test —
 * a mismatch fails `sealDistinctionRecord` admission, never silently).
 */
const W036_DISTINCTION_RECORD_SCHEMA = 'epoch.solution-delivery.distinction-record' as const;

/** The serialized schema name of a capture envelope. */
export const FIELD_CAPTURE_SCHEMA_NAME = 'field.capture-envelope' as const;

// ---------------------------------------------------------------------------
// Work-package linkage (opaque ids; ambiguity is a typed rejection).
// ---------------------------------------------------------------------------

/**
 * The linkage INPUT: either an exactly resolved work package id, or an
 * UNRESOLVED set of candidates (the field worker could not disambiguate
 * which package the observation belongs to). Envelope admission REQUIRES a
 * resolved link — unresolved candidates are the typed
 * `ambiguous-linkage-rejected` rejection (never a guess).
 */
export const WorkPackageLinkInputSchema = z
  .discriminatedUnion('status', [
    z
      .strictObject({
        status: z.literal('resolved'),
        workPackageId: WorkPackageIdSchema,
      })
      .readonly(),
    z
      .strictObject({
        status: z.literal('unresolved'),
        candidateWorkPackageIds: z.array(WorkPackageIdSchema).min(2).max(16),
      })
      .readonly(),
  ])
  .meta({
    id: 'WorkPackageLinkInput',
    title: 'WorkPackageLinkInput',
    description:
      'Work-package linkage input: exactly resolved by opaque id, or explicitly unresolved with its candidates (admission rejects ambiguity).',
  });

/** One work-package link input. */
export type WorkPackageLinkInput = z.infer<typeof WorkPackageLinkInputSchema>;

/** The RESOLVED link carried on the envelope (ambiguity never seals). */
export const ResolvedWorkPackageLinkSchema = z
  .strictObject({
    status: z.literal('resolved'),
    workPackageId: WorkPackageIdSchema,
  })
  .readonly()
  .meta({
    id: 'ResolvedWorkPackageLink',
    title: 'ResolvedWorkPackageLink',
    description: 'The resolved work-package linkage: one opaque work-package id.',
  });

/** One resolved work-package link. */
export type ResolvedWorkPackageLink = z.infer<typeof ResolvedWorkPackageLinkSchema>;

// ---------------------------------------------------------------------------
// Capture context (provenance of the capture itself).
// ---------------------------------------------------------------------------

/**
 * The capture context: provenance every capture carries. The device
 * descriptor digest pins WHICH field-fidelity surface captured the
 * observation; `offline` marks captures queued for later sync admission.
 */
export const CaptureContextSchema = z
  .strictObject({
    deviceDescriptorDigest: Sha256HexSchema,
    offline: z.boolean(),
    note: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'CaptureContext',
    title: 'CaptureContext',
    description:
      'Provenance of one field capture: the field device descriptor digest, the offline flag, and an optional note.',
  });

/** One capture context. */
export type CaptureContext = z.infer<typeof CaptureContextSchema>;

// ---------------------------------------------------------------------------
// The capture envelope.
// ---------------------------------------------------------------------------

/**
 * The immutable content of one capture envelope: identity, tenant scope,
 * session linkage, the W036 observation measure + subject + payload +
 * MANDATORY uncertainty, evidence references (by digest), the resolved
 * work-package link, and the capture context. Everything a real native
 * client would carry on the wire.
 */
const fieldCaptureShape = z.strictObject({
  schema: z.literal(FIELD_CAPTURE_SCHEMA_NAME),
  schemaVersion: z.literal(MOBILE_FIELD_RECORD_VERSION),
  captureId: FieldCaptureIdSchema,
  tenantId: TenantIdSchema,
  sessionId: FieldSessionIdSchema,
  solutionId: SolutionIdSchema,
  deliveryId: DeliveryIdSchema,
  observationId: DistinctionRecordIdSchema,
  capturedBy: PrincipalIdSchema,
  capturedAt: TimestampSchema,
  /** The W036 quantity/progress measure (quantity value+unit, or 0..1 progress). */
  measure: MeasureSchema,
  /** The W036 uncertainty state — MANDATORY (typed rejection when missing). */
  uncertainty: UncertaintyStateSchema,
  /** Photo/sensor/note references by digest (sorted, duplicate-free, bounded). */
  evidence: FieldEvidenceRefArraySchema,
  /** The resolved work-package linkage by opaque id. */
  link: ResolvedWorkPackageLinkSchema,
  /** Provenance of the capture itself. */
  context: CaptureContextSchema,
});

/** The shared content refinement (applied to BOTH content and sealed forms). */
function refineFieldCapture(
  content: {
    observationId: string;
    deliveryId: string;
    capturedAt: string;
    capturedBy: string;
    evidence: readonly { digest: string }[];
  },
  ctx: z.RefinementCtx,
): void {
  // The observation id must carry the observation kind prefix (the W036
  // distinction-id grammar: one record identity belongs to one kind).
  if (!content.observationId.startsWith('observation:')) {
    ctx.addIssue({
      code: 'custom',
      message:
        'a capture envelope carries a W036 observation record — observationId must carry the "observation:" prefix',
      path: ['observationId'],
    });
  }
  // W036 ObservationPayload requires the evidence array sorted by digest;
  // FieldEvidenceRef carries the same digest order, and the conversion
  // drops the field kind/capturedAt into the W006-convention digest-only
  // reference. Structural check: the payload shape must be constructible.
  const payloadCheck = ObservationPayloadSchema.safeParse({
    deliveryId: content.deliveryId,
    observedAt: content.capturedAt,
    observedBy: content.capturedBy,
    evidence: content.evidence.map((ref) => ({ digest: ref.digest })),
  });
  if (!payloadCheck.success) {
    for (const issue of payloadCheck.error.issues) {
      ctx.addIssue({
        code: 'custom',
        message: `the capture is not a valid W036 observation payload: ${issue.message}`,
        path: ['evidence'],
      });
    }
  }
}

export const FieldCaptureContentSchema = fieldCaptureShape
  .superRefine(refineFieldCapture)
  .readonly()
  .meta({
    id: 'FieldCaptureContent',
    title: 'FieldCaptureContent',
    description:
      'The immutable content of one field capture envelope: the W036-shaped observation (measure, subject, mandatory uncertainty), evidence by digest, resolved work-package linkage, and capture provenance.',
  });

/** One capture envelope content. */
export type FieldCaptureContent = z.infer<typeof FieldCaptureContentSchema>;

/** The sealed capture envelope: content plus its SHA-256 content digest. */
export const SealedFieldCaptureSchema = z
  .strictObject({
    ...fieldCaptureShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .superRefine(refineFieldCapture)
  .readonly()
  .meta({
    id: 'SealedFieldCapture',
    title: 'SealedFieldCapture',
    description:
      'The sealed capture envelope: immutable W036-shaped observation content plus its SHA-256 content digest (exact-revision, replay-safe addressing).',
  });

/** One sealed capture envelope. */
export type SealedFieldCapture = z.infer<typeof SealedFieldCaptureSchema>;

// ---------------------------------------------------------------------------
// Admission + sealing.
// ---------------------------------------------------------------------------

/** Options to admit + seal a capture envelope. */
export interface SealFieldCaptureOptions {
  readonly captureId: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly solutionId: string;
  readonly deliveryId: string;
  readonly observationId: string;
  readonly capturedBy: string;
  readonly capturedAt: string;
  /** The quantity/progress measure (W036 grammar). */
  readonly measure: Measure | unknown;
  /** The MANDATORY uncertainty state (W036 grammar) — missing is a typed rejection. */
  readonly uncertainty: UncertaintyState | unknown;
  /** Photo/sensor/note evidence references BY DIGEST. */
  readonly evidence: readonly FieldEvidenceRef[] | readonly unknown[];
  /** The work-package linkage input — ambiguity is a typed rejection. */
  readonly link: WorkPackageLinkInput | unknown;
  readonly context: CaptureContext | unknown;
}

/**
 * Admit + seal a capture envelope (the total form). Typed rejections:
 * - `ambiguous-linkage-rejected` — unresolved work-package candidates;
 * - `uncertainty-missing-rejected` — no uncertainty state on the capture;
 * - `evidence-payload-rejected` — an attempt to embed evidence payloads;
 * - `validation` / `vendor-fields-rejected` — shape or unknown-key drift;
 * - `version-mismatch` — schemaVersion skew (enforced by the literal pin).
 */
export function sealFieldCapture(options: SealFieldCaptureOptions): MobileFieldResult<SealedFieldCapture> {
  // 0. The options themselves must be a plain object (typed rejection, never
  // a runtime exception on malformed input).
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    return fieldError({
      code: 'validation',
      message: 'capture options must be a plain object',
      issues: [{ path: '', message: 'expected a plain object' }],
    });
  }
  // 1. The linkage must be resolved — ambiguity is a typed rejection, never a guess.
  const link = WorkPackageLinkInputSchema.safeParse(options.link);
  if (!link.success) {
    return fieldError(fieldValidationError(link.error));
  }
  if (link.data.status === 'unresolved') {
    return fieldError({
      code: 'ambiguous-linkage-rejected',
      message:
        `work-package linkage is unresolved (${link.data.candidateWorkPackageIds.length} candidates: ` +
        `${link.data.candidateWorkPackageIds.join(', ')}) — ambiguous linkage is a typed rejection, never a guess; ` +
        'disambiguate the target work package before capturing',
    });
  }

  // 2. The uncertainty state is MANDATORY on every capture (W036 grammar).
  const uncertainty = UncertaintyStateSchema.safeParse(options.uncertainty);
  if (!uncertainty.success) {
    const missing = options.uncertainty === undefined || options.uncertainty === null;
    if (missing) {
      return fieldError({
        code: 'uncertainty-missing-rejected',
        message:
          'a field capture without the uncertainty state is inexpressible — provenance, freshness and confidence are mandatory (the W036 decision-sufficiency rule)',
        issues: [{ path: 'uncertainty', message: 'the uncertainty state is required' }],
      });
    }
    if (hasUnrecognizedKeys(uncertainty.error)) {
      return fieldError(vendorFieldsError(uncertainty.error));
    }
    return fieldError({
      code: 'uncertainty-missing-rejected',
      message:
        'the capture carries an invalid uncertainty state — provenance, freshness AND confidence are all mandatory (the W036 decision-sufficiency rule)',
      issues: flattenZodIssues(uncertainty.error),
    });
  }

  // 3. Evidence references: digest-only admission (payloads rejected).
  const evidence: FieldEvidenceRef[] = [];
  if (Array.isArray(options.evidence)) {
    for (const candidate of options.evidence) {
      const admitted = admitFieldEvidenceRef(candidate);
      if (!admitted.ok) {
        return admitted;
      }
      evidence.push(admitted.value);
    }
  } else if (options.evidence !== undefined) {
    return fieldError({
      code: 'validation',
      message: 'capture evidence must be an array of field evidence references',
    });
  }

  // 4. Assemble + validate the full content against the strict schema.
  const content = {
    schema: FIELD_CAPTURE_SCHEMA_NAME,
    schemaVersion: MOBILE_FIELD_RECORD_VERSION,
    captureId: options.captureId,
    tenantId: options.tenantId,
    sessionId: options.sessionId,
    solutionId: options.solutionId,
    deliveryId: options.deliveryId,
    observationId: options.observationId,
    capturedBy: options.capturedBy,
    capturedAt: options.capturedAt,
    measure: options.measure,
    uncertainty: uncertainty.data,
    evidence: evidence.sort((a, b) => (a.digest < b.digest ? -1 : a.digest > b.digest ? 1 : 0)),
    link: { status: 'resolved' as const, workPackageId: link.data.workPackageId },
    context: options.context,
  };
  const parsed = FieldCaptureContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return fieldError(vendorFieldsError(parsed.error));
    }
    return fieldError(fieldValidationError(parsed.error));
  }
  return fieldOk({
    ...parsed.data,
    contentDigest: canonicalDigest(parsed.data as unknown as JsonValue),
  });
}

/** Verify a sealed capture envelope (schema + digest recomputation). */
export function verifySealedFieldCapture(sealed: unknown): MobileFieldResult<SealedFieldCapture> {
  const parsed = SealedFieldCaptureSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return fieldError(vendorFieldsError(parsed.error));
    }
    return fieldError(fieldValidationError(parsed.error));
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return fieldError(digestMismatchError(expected, contentDigest));
  }
  return fieldOk(parsed.data);
}

// ---------------------------------------------------------------------------
// The W036 conversion (envelope -> Observation-distinction record).
// ---------------------------------------------------------------------------

/** The conversion input: what the observation record ids/provenance are. */
export interface ToObservationOptions {
  /** The W036 record id (must carry the "observation:" prefix). */
  readonly recordId: string;
  readonly recordedAt: string;
  readonly recordedBy: string;
}

/**
 * Convert a sealed capture envelope into the W036 Observation-distinction
 * record (sealed through @epoch/solution-delivery's own
 * `sealDistinctionRecord` — the kernel's sealing machinery, never a local
 * re-implementation). The observation:
 *
 * - references the SAME subject (solution + work-package, by opaque id);
 * - carries the SAME measure and uncertainty (mandatory state preserved);
 * - payload evidence becomes the W036 `EvidenceReference { digest }` list
 *   (the W006 convention — digests only);
 * - provenance: recordedBy/recordedAt carry the conversion provenance,
 *   while the capture's own provenance lives in the uncertainty state's
 *   `observed` provenance kind and the capture context.
 */
export function toObservationRecord(
  capture: SealedFieldCapture,
  options: ToObservationOptions,
): MobileFieldResult<ObservationRecord> {
  const verified = verifySealedFieldCapture(capture);
  if (!verified.ok) {
    return verified;
  }
  const envelope = verified.value;
  if (!options.recordId.startsWith('observation:')) {
    return fieldError({
      code: 'validation',
      message:
        'the conversion record id must carry the W036 "observation:" prefix (one record identity belongs to one semantic distinction)',
      issues: [{ path: 'recordId', message: `encountered "${options.recordId}"` }],
    });
  }
  const subject = DistinctionSubjectSchema.safeParse({
    solutionId: envelope.solutionId,
    subjectKind: 'work-package',
    subjectId: envelope.link.workPackageId,
  });
  if (!subject.success) {
    return fieldError(fieldValidationError(subject.error));
  }
  const content = {
    schema: W036_DISTINCTION_RECORD_SCHEMA,
    schemaVersion: SOLUTION_DELIVERY_RECORD_VERSION,
    recordId: options.recordId,
    tenantId: envelope.tenantId,
    subject: subject.data,
    recordedAt: options.recordedAt,
    recordedBy: options.recordedBy,
    uncertainty: envelope.uncertainty,
    kind: 'observation' as const,
    measure: envelope.measure,
    payload: {
      deliveryId: envelope.deliveryId,
      observedAt: envelope.capturedAt,
      observedBy: envelope.capturedBy,
      evidence: envelope.evidence.map((ref) => ({ digest: ref.digest })),
    },
  };
  // Validate through the kernel's own pipeline first (shape + refinements).
  const sealed = sealDistinctionRecord(content);
  if (!sealed.ok) {
    return fieldError({
      code: 'validation',
      message: `the capture envelope did not convert to a valid W036 observation record: ${sealed.error.message}`,
      issues: 'issues' in sealed.error && Array.isArray(sealed.error.issues)
        ? sealed.error.issues.map((issue) => ({ path: String(issue.path), message: issue.message }))
        : [{ path: '', message: sealed.error.message }],
    });
  }
  const recordCheck = ObservationRecordSchema.safeParse(sealed.value);
  if (!recordCheck.success) {
    return fieldError(fieldValidationError(recordCheck.error));
  }
  return fieldOk(recordCheck.data);
}

/** Tenant guard: a capture scoped to the given tenant (typed rejection otherwise). */
export function captureTenantGuard(
  capture: SealedFieldCapture,
  tenantId: string,
): MobileFieldResult<SealedFieldCapture> {
  if (capture.tenantId !== tenantId) {
    return fieldError(crossTenantDeniedError(tenantId, capture.tenantId));
  }
  return fieldOk(capture);
}

/** Session guard: a capture linked to the given session (typed rejection otherwise). */
export function captureSessionGuard(
  capture: SealedFieldCapture,
  session: { sessionId: string; tenantId: string; state: string },
): MobileFieldResult<SealedFieldCapture> {
  if (capture.sessionId !== session.sessionId) {
    return fieldError({
      code: 'validation',
      message: `capture "${capture.captureId}" belongs to session "${capture.sessionId}" but the active session is "${session.sessionId}"`,
    });
  }
  if (capture.tenantId !== session.tenantId) {
    return fieldError(crossTenantDeniedError(session.tenantId, capture.tenantId));
  }
  return fieldOk(capture);
}

export type { SealedDistinctionRecord };
export type { Sha256Hex };
