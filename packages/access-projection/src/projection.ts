/**
 * The AuthorizedProjection family — the projection STAGE output (the W041
 * dispatch pin).
 *
 * - Minimum-necessary field selection: entries are either RELEASED
 *   (field path + value BY REFERENCE — same value, same digest as the
 *   canonical record) or a typed RedactionMarker (field path + policy
 *   clause + redaction class). Fields are NEVER silently dropped
 *   (`redaction-marker-required`).
 * - Stable semantic identity: the projection carries the SAME record id
 *   and content digest as the canonical record — it never mints a new
 *   identity (`identity-fork-rejected`), and two roles' projections of
 *   one object share the object id.
 * - The projection cites the exact policy revision (by digest) and the
 *   exact W009 decision (by digest) it was computed under.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  PolicyIdSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  TimestampSchema,
} from './primitives';
import {
  ACCESS_PROJECTION_RECORD_VERSION,
  AUTHORIZED_PROJECTION_SCHEMA_NAME,
  OBJECT_CLASSES,
  PROJECTION_ACTIONS,
} from './version';
import { PolicyRevisionRefSchema, ProjectionSubjectSchema } from './policy';
import { TaskProjectionContextSchema, type TaskProjectionContext } from './task';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { AccessProjectionResult } from './errors';

// --------------------------------------------------------------------------------
// Redaction markers (typed, never a silent drop).
// --------------------------------------------------------------------------------

/** The policy clause that justified one redaction (binding citation). */
export const PolicyClauseRefSchema = z
  .strictObject({
    policyId: PolicyIdSchema,
    revision: PositiveIntegerSchema,
    bindingIndex: PositiveIntegerSchema,
  })
  .readonly()
  .meta({
    id: 'PolicyClauseRef',
    title: 'PolicyClauseRef',
    description:
      'The policy clause behind one redaction: the exact policy revision and the binding row that struck the field.',
  });

/** One policy clause reference. */
export type PolicyClauseRef = z.infer<typeof PolicyClauseRefSchema>;

/**
 * One redaction marker: the typed placeholder a non-released field
 * becomes. Carries the field path, the striking policy clause, and the
 * redaction class — never the value, never a vendor label.
 */
export const RedactionMarkerSchema = z
  .strictObject({
    kind: z.literal('redacted'),
    path: z.string().min(1).max(512),
    clause: PolicyClauseRefSchema,
    redactionClass: z.enum([
      'commercial-sensitive',
      'supplier-sensitive',
      'evidence-scoped',
      'principal-identifying',
      'policy-scoped',
      'task-scoped',
    ]),
  })
  .readonly()
  .meta({
    id: 'RedactionMarker',
    title: 'RedactionMarker',
    description:
      'One redaction marker: the field path struck by a policy clause, with the redaction class (field path + policy clause + redaction class; never the value).',
  });

/** One redaction marker. */
export type RedactionMarker = z.infer<typeof RedactionMarkerSchema>;

// --------------------------------------------------------------------------------
// Projection entries (released-by-reference | redaction marker).
// --------------------------------------------------------------------------------

/** One released field: the path and the value BY REFERENCE. */
export const ReleasedFieldSchema = z
  .strictObject({
    kind: z.literal('released'),
    path: z.string().min(1).max(512),
    value: z.unknown(),
  })
  .readonly()
  .meta({
    id: 'ReleasedField',
    title: 'ReleasedField',
    description:
      'One released field: the concrete walk path and the canonical value, passed through BY REFERENCE (same value, same digest).',
  });

/** One released field. */
export type ReleasedField = z.infer<typeof ReleasedFieldSchema>;

/**
 * One projection entry: a released field or a redaction marker (the
 * discriminated union every walked leaf becomes — nothing is dropped).
 */
export const ProjectionEntrySchema = z
  .discriminatedUnion('kind', [ReleasedFieldSchema, RedactionMarkerSchema])
  .meta({
    id: 'ProjectionEntry',
    title: 'ProjectionEntry',
    description:
      'One projection entry: a released field (value by reference) or a typed redaction marker (field path + policy clause + redaction class).',
  });

/** One projection entry. */
export type ProjectionEntry = z.infer<typeof ProjectionEntrySchema>;

// --------------------------------------------------------------------------------
// The authorized projection record family.
// --------------------------------------------------------------------------------

/** The immutable content of one authorized projection. */
export const AuthorizedProjectionContentSchema = z
  .strictObject({
    schema: z.literal(AUTHORIZED_PROJECTION_SCHEMA_NAME),
    schemaVersion: z.literal(ACCESS_PROJECTION_RECORD_VERSION),
    tenantId: TenantIdSchema,
    objectClass: z.enum(OBJECT_CLASSES),
    objectId: z.string().min(1).max(256),
    objectDigest: z.string().regex(/^[0-9a-f]{64}$/),
    policyRef: PolicyRevisionRefSchema,
    decisionDigest: z.string().regex(/^[0-9a-f]{64}$/),
    subject: ProjectionSubjectSchema,
    action: z.enum(PROJECTION_ACTIONS),
    taskContext: TaskProjectionContextSchema.optional(),
    entries: z.array(ProjectionEntrySchema).min(1).max(16384),
    projectedAt: TimestampSchema,
    projectedBy: PrincipalIdSchema,
  })
  .readonly()
  .superRefine((projection, ctx) => {
    for (let i = 1; i < projection.entries.length; i += 1) {
      if (projection.entries[i]!.path < projection.entries[i - 1]!.path) {
        ctx.addIssue({
          code: 'custom',
          message: 'entries must be sorted by path ascending (deterministic serialization)',
          path: ['entries'],
        });
        break;
      }
      if (projection.entries[i]!.path === projection.entries[i - 1]!.path) {
        ctx.addIssue({
          code: 'custom',
          message: 'entries must be duplicate-free by path (every walked leaf appears exactly once)',
          path: ['entries'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'AuthorizedProjectionContent',
    title: 'AuthorizedProjectionContent',
    description:
      'The immutable content of one authorized projection: the canonical object identity (id + digest, never minted), the policy revision and decision digests it was computed under, the subject/action, and the sorted entry set (released fields + redaction markers).',
  });

/** One authorized projection content. */
export type AuthorizedProjectionContent = z.infer<typeof AuthorizedProjectionContentSchema>;

/**
 * The SEALED authorized projection: content plus its SHA-256 digest over
 * the canonical JSON of the content.
 */
export const SealedAuthorizedProjectionSchema = z
  .strictObject({
    schema: z.literal(AUTHORIZED_PROJECTION_SCHEMA_NAME),
    schemaVersion: z.literal(ACCESS_PROJECTION_RECORD_VERSION),
    tenantId: TenantIdSchema,
    objectClass: z.enum(OBJECT_CLASSES),
    objectId: z.string().min(1).max(256),
    objectDigest: z.string().regex(/^[0-9a-f]{64}$/),
    policyRef: PolicyRevisionRefSchema,
    decisionDigest: z.string().regex(/^[0-9a-f]{64}$/),
    subject: ProjectionSubjectSchema,
    action: z.enum(PROJECTION_ACTIONS),
    taskContext: TaskProjectionContextSchema.optional(),
    entries: z.array(ProjectionEntrySchema).min(1).max(16384),
    projectedAt: TimestampSchema,
    projectedBy: PrincipalIdSchema,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .superRefine((projection, ctx) => {
    for (let i = 1; i < projection.entries.length; i += 1) {
      if (
        projection.entries[i]!.path < projection.entries[i - 1]!.path ||
        projection.entries[i]!.path === projection.entries[i - 1]!.path
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'entries must be sorted and duplicate-free by path',
          path: ['entries'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'SealedAuthorizedProjection',
    title: 'SealedAuthorizedProjection',
    description:
      'Published authorized projection: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed authorized projection. */
export type SealedAuthorizedProjection = z.infer<typeof SealedAuthorizedProjectionSchema>;

/** Compute the content digest of an authorized projection. */
export function computeAuthorizedProjectionDigest(
  content: AuthorizedProjectionContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid authorized-projection content into its published record. */
export function sealAuthorizedProjection(
  content: unknown,
): AccessProjectionResult<SealedAuthorizedProjection> {
  const parsed = AuthorizedProjectionContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeAuthorizedProjectionDigest(parsed.data) },
  };
}

/** Verify a sealed authorized projection: schema + recomputed digest. */
export function verifySealedAuthorizedProjection(
  sealed: unknown,
): AccessProjectionResult<SealedAuthorizedProjection> {
  const parsed = SealedAuthorizedProjectionSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `authorized projection of "${parsed.data.objectId}" carries a tampered content digest`,
        expected: recomputed,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The released value at one path (null when the path is redacted/absent). */
export function releasedValueOf(
  projection: SealedAuthorizedProjection,
  path: string,
): JsonValue | null {
  for (const entry of projection.entries) {
    if (entry.path === path) {
      return entry.kind === 'released' ? (entry.value as JsonValue) : null;
    }
  }
  return null;
}

/** The sorted released paths of one projection. */
export function releasedPathsOf(projection: SealedAuthorizedProjection): readonly string[] {
  return projection.entries
    .filter((entry): entry is ReleasedField => entry.kind === 'released')
    .map((entry) => entry.path)
    .sort();
}

/** The sorted redacted paths of one projection. */
export function redactedPathsOf(projection: SealedAuthorizedProjection): readonly string[] {
  return projection.entries
    .filter((entry): entry is RedactionMarker => entry.kind === 'redacted')
    .map((entry) => entry.path)
    .sort();
}

// Re-exports consumed by the evaluation pipeline and downstream hosts.
export { TaskProjectionContextSchema };
export type { TaskProjectionContext };