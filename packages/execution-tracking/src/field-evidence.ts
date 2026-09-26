/**
 * Field evidence references (W038 pin): evidence links are TYPED
 * REFERENCES to W006 evidence records by digest (photos, sensor
 * readings, documents — opaque references with capture context; NEVER
 * embedded payloads).
 *
 * Two shapes:
 *
 * - {@link FieldEvidenceLink} — the embedded typed reference carried on
 *   every execution-tracking record family: the W006 evidence record's
 *   exact-revision SHA-256 digest plus the capture context (kind,
 *   capturedAt, capturedBy, optional opaque capture method and note).
 *   The digest grammar is REUSED from the W036 kernel (runtime
 *   composition) and pinned to the REAL W006 evidence digests by the
 *   runtime parity test. NO payload bytes ever enter this package;
 * - {@link SealedFieldEvidenceLinkRecord} — the standalone, sealed,
 *   append-only record admitted by the tracking store (one per link of
 *   a field capture, carrying the inferred work-package linkage and the
 *   linked observation record id), so capture context is queryable
 *   without loading the referenced W006 payloads.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  PrincipalIdSchema,
  OpaqueReferenceSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  WorkPackageIdSchema,
} from '@epoch/solution-delivery';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  ActivityIdSchema,
  DistinctionRecordIdSchema,
  EvidenceLinkIdSchema,
  FieldCaptureKeySchema,
  StateIdSchema,
} from './primitives';
import { FIELD_EVIDENCE_KINDS, FIELD_EVIDENCE_LINK_SCHEMA_NAME, EXECUTION_TRACKING_RECORD_VERSION } from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ExecutionResult } from './errors';

// --------------------------------------------------------------------------------
// The embedded typed reference (carried on every record family).
// --------------------------------------------------------------------------------

/** One field-evidence reference: the W006 digest plus capture context (never a payload). */
export const FieldEvidenceLinkSchema = z
  .strictObject({
    digest: Sha256HexSchema,
    evidenceKind: z.enum(FIELD_EVIDENCE_KINDS),
    capturedAt: TimestampSchema,
    capturedBy: PrincipalIdSchema,
    captureMethod: OpaqueReferenceSchema.optional(),
    note: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'FieldEvidenceLink',
    title: 'FieldEvidenceLink',
    description:
      'One field-evidence reference: the W006 evidence record digest (photo, sensor reading, or document) plus capture context — captured instant and principal, optional opaque capture method and note. NEVER an embedded payload.',
  });

/** One field-evidence reference. */
export type FieldEvidenceLink = z.infer<typeof FieldEvidenceLinkSchema>;

/** Sorted/duplicate-free refinement for embedded evidence-link arrays. */
export function refineSortedEvidenceLinks(
  links: readonly { readonly digest: string }[],
  ctx: z.RefinementCtx,
  path: string,
): void {
  for (let i = 1; i < links.length; i += 1) {
    if (links[i]!.digest < links[i - 1]!.digest) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be sorted by digest ascending (deterministic serialization)`,
        path: [path],
      });
      break;
    }
    if (links[i]!.digest === links[i - 1]!.digest) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be duplicate-free by digest`,
        path: [path],
      });
      break;
    }
  }
}

/** The embedded evidence-link array grammar (max 64, sorted, duplicate-free). */
export const FieldEvidenceLinkArraySchema = z
  .array(FieldEvidenceLinkSchema)
  .max(64)
  .superRefine((links, ctx) => refineSortedEvidenceLinks(links, ctx, 'evidenceLinks'));

// --------------------------------------------------------------------------------
// The standalone sealed field-evidence-link record.
// --------------------------------------------------------------------------------

/**
 * The immutable content of one field-evidence-link record: the typed
 * W006 reference with capture context, the inferred work-package
 * linkage, and the optional observation/tracking records it evidences.
 */
export const FieldEvidenceLinkRecordContentSchema = z
  .strictObject({
    schema: z.literal(FIELD_EVIDENCE_LINK_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: EvidenceLinkIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    digest: Sha256HexSchema,
    evidenceKind: z.enum(FIELD_EVIDENCE_KINDS),
    capturedAt: TimestampSchema,
    capturedBy: PrincipalIdSchema,
    captureMethod: OpaqueReferenceSchema.optional(),
    note: z.string().max(2048).optional(),
    workPackageId: WorkPackageIdSchema,
    activityId: ActivityIdSchema.optional(),
    linkedObservationId: DistinctionRecordIdSchema.optional(),
    linkedTrackingRecordId: StateIdSchema.optional(),
    captureKey: FieldCaptureKeySchema.optional(),
    recordedAt: TimestampSchema,
  })
  .readonly()
  .superRefine((record, ctx) => {
    if (record.capturedAt > record.recordedAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'recordedAt must not precede capturedAt (capture context precedes recording)',
        path: ['recordedAt'],
      });
    }
  })
  .meta({
    id: 'FieldEvidenceLinkRecordContent',
    title: 'FieldEvidenceLinkRecordContent',
    description:
      'The immutable content of one field-evidence-link record: the W006 evidence digest with capture context, the linked work package/activity, the evidenced observation/tracking record ids, and the recording instant.',
  });

/** One field-evidence-link record content. */
export type FieldEvidenceLinkRecordContent = z.infer<typeof FieldEvidenceLinkRecordContentSchema>;

/** The SEALED field-evidence-link record: content plus its SHA-256 content digest. */
export const SealedFieldEvidenceLinkSchema = z
  .strictObject({
    schema: z.literal(FIELD_EVIDENCE_LINK_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: EvidenceLinkIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    digest: Sha256HexSchema,
    evidenceKind: z.enum(FIELD_EVIDENCE_KINDS),
    capturedAt: TimestampSchema,
    capturedBy: PrincipalIdSchema,
    captureMethod: OpaqueReferenceSchema.optional(),
    note: z.string().max(2048).optional(),
    workPackageId: WorkPackageIdSchema,
    activityId: ActivityIdSchema.optional(),
    linkedObservationId: DistinctionRecordIdSchema.optional(),
    linkedTrackingRecordId: StateIdSchema.optional(),
    captureKey: FieldCaptureKeySchema.optional(),
    recordedAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedFieldEvidenceLink',
    title: 'SealedFieldEvidenceLink',
    description:
      'The sealed field-evidence-link record: immutable typed W006 reference content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed field-evidence-link record. */
export type SealedFieldEvidenceLink = z.infer<typeof SealedFieldEvidenceLinkSchema>;

/** Compute the content digest of a field-evidence-link record content. */
export function computeFieldEvidenceLinkDigest(
  content: FieldEvidenceLinkRecordContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid field-evidence-link record content into its published record. */
export function sealFieldEvidenceLink(
  content: unknown,
): ExecutionResult<SealedFieldEvidenceLink> {
  const parsed = FieldEvidenceLinkRecordContentSchema.safeParse(content);
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
 * Verify a sealed field-evidence-link record: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedFieldEvidenceLink(
  sealed: unknown,
): ExecutionResult<SealedFieldEvidenceLink> {
  const parsed = SealedFieldEvidenceLinkSchema.safeParse(sealed);
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
          'sealed field-evidence-link record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
