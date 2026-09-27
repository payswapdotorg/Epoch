/**
 * The ProjectionAuditRecord family — the AUDITABILITY pin (the W041
 * dispatch): EVERY projection decision emits a sealed, content-addressed
 * audit record: principal, policy revision (by digest), object digest,
 * decision digest, fields released, fields redacted (paths), scopes
 * applied, instant (caller-supplied).
 *
 * The trail is append-only and replay-safe: identical inputs produce
 * identical digests, and every audit record carries its EVALUATION KEY —
 * the content digest of the exact evaluation request (tenant, subject,
 * action, policy revision, object revision, decision, task class,
 * instant). A re-evaluation of the same request is the SEALED PRIOR
 * audit record (idempotent admission); a second record under the SAME
 * key with DIFFERENT content is the typed `replay-conflict` (the trail
 * refuses to fork).
 *
 * Provenance (the W006/W036 convention): every audit record carries a
 * derived-provenance block (kind/sourceRef/actor — the same shape as the
 * W036 uncertainty provenance, pinned by kernel parity).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { PROVENANCE_KINDS, TenantIdSchema } from '@epoch/solution-delivery';
import {
  AuditRecordIdSchema,
  PrincipalIdSchema,
  TimestampSchema,
} from './primitives';
import {
  ACCESS_PROJECTION_RECORD_VERSION,
  EVALUATION_KEY_SCOPE,
  OBJECT_CLASSES,
  PROJECTION_ACTIONS,
  PROJECTION_AUDIT_SCHEMA_NAME,
  type ObjectClass,
  type ProjectionAction,
} from './version';
import { PolicyRevisionRefSchema, ProjectionSubjectSchema } from './policy';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { AccessProjectionResult } from './errors';

// --------------------------------------------------------------------------------
// Provenance (the W006/W036 convention).
// --------------------------------------------------------------------------------

/** The derived provenance block of one audit record (W036 shape). */
export const AuditProvenanceSchema = z
  .strictObject({
    kind: z.enum(PROVENANCE_KINDS),
    sourceRef: z.string().min(1).max(256).optional(),
    actor: PrincipalIdSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'AuditProvenance',
    title: 'AuditProvenance',
    description:
      'The provenance block of one audit record (the W006/W036 provenance convention): derived from the sealed decision + policy revision + canonical record.',
  });

/** One audit provenance block. */
export type AuditProvenance = z.infer<typeof AuditProvenanceSchema>;

/** The default provenance of kernel-emitted audit records. */
export function kernelAuditProvenance(actor: string | undefined): AuditProvenance {
  return {
    kind: 'derived',
    sourceRef: 'source:access-projection-evaluation',
    ...(actor !== undefined ? { actor } : {}),
  };
}

// --------------------------------------------------------------------------------
// The applied-scope summary (what the evaluation applied).
// --------------------------------------------------------------------------------

/** The scope summary one audit record carries. */
export const AppliedScopesSchema = z
  .strictObject({
    evidenceMode: z.enum(['all', 'listed', 'none']),
    allowedEvidenceCount: z.number().int().min(0).max(512),
    commercial: z.enum(['visible', 'hidden']),
    supplier: z.enum(['visible', 'hidden']),
  })
  .readonly()
  .meta({
    id: 'AppliedScopes',
    title: 'AppliedScopes',
    description:
      'The scope filters one evaluation applied: evidence mode (+ allowlist size), commercial and supplier section visibility.',
  });

/** One applied-scope summary. */
export type AppliedScopes = z.infer<typeof AppliedScopesSchema>;

// --------------------------------------------------------------------------------
// The audit record family.
// --------------------------------------------------------------------------------

/** The immutable content of one projection audit record. */
export const ProjectionAuditContentSchema = z
  .strictObject({
    schema: z.literal(PROJECTION_AUDIT_SCHEMA_NAME),
    schemaVersion: z.literal(ACCESS_PROJECTION_RECORD_VERSION),
    auditId: AuditRecordIdSchema,
    tenantId: TenantIdSchema,
    principalId: PrincipalIdSchema,
    subject: ProjectionSubjectSchema,
    policyRef: PolicyRevisionRefSchema,
    objectClass: z.enum(OBJECT_CLASSES),
    objectId: z.string().min(1).max(256),
    objectDigest: z.string().regex(/^[0-9a-f]{64}$/),
    decisionDigest: z.string().regex(/^[0-9a-f]{64}$/),
    action: z.enum(PROJECTION_ACTIONS),
    outcome: z.enum(['released', 'denied']),
    denialCode: z.string().min(1).max(64).optional(),
    fieldsReleased: z.array(z.string().min(1).max(512)).max(16384),
    fieldsRedacted: z.array(z.string().min(1).max(512)).max(16384),
    appliedScopes: AppliedScopesSchema,
    evaluationKey: z.string().regex(/^[0-9a-f]{64}$/),
    provenance: AuditProvenanceSchema,
    projectedAt: TimestampSchema,
  })
  .readonly()
  .superRefine((audit, ctx) => {
    if (audit.outcome === 'denied' && audit.denialCode === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a denied outcome carries its typed denialCode',
        path: ['denialCode'],
      });
    }
    if (audit.outcome === 'released' && audit.denialCode !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a released outcome carries no denialCode',
        path: ['denialCode'],
      });
    }
    for (const [label, paths] of [
      ['fieldsReleased', audit.fieldsReleased],
      ['fieldsRedacted', audit.fieldsRedacted],
    ] as const) {
      for (let i = 1; i < paths.length; i += 1) {
        if (paths[i]! < paths[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `${label} must be sorted ascending (deterministic serialization)`,
            path: [label],
          });
          break;
        }
        if (paths[i]! === paths[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `${label} must be duplicate-free`,
            path: [label],
          });
          break;
        }
      }
    }
  })
  .meta({
    id: 'ProjectionAuditContent',
    title: 'ProjectionAuditContent',
    description:
      'The immutable content of one projection audit record: principal, policy revision, object + decision digests, action, outcome, released/redacted path sets, applied scopes, evaluation key, provenance, instant.',
  });

/** One projection audit content. */
export type ProjectionAuditContent = z.infer<typeof ProjectionAuditContentSchema>;

/**
 * The SEALED projection audit record: content plus its SHA-256 digest
 * over the canonical JSON of the content.
 */
export const SealedProjectionAuditSchema = z
  .strictObject({
    schema: z.literal(PROJECTION_AUDIT_SCHEMA_NAME),
    schemaVersion: z.literal(ACCESS_PROJECTION_RECORD_VERSION),
    auditId: AuditRecordIdSchema,
    tenantId: TenantIdSchema,
    principalId: PrincipalIdSchema,
    subject: ProjectionSubjectSchema,
    policyRef: PolicyRevisionRefSchema,
    objectClass: z.enum(OBJECT_CLASSES),
    objectId: z.string().min(1).max(256),
    objectDigest: z.string().regex(/^[0-9a-f]{64}$/),
    decisionDigest: z.string().regex(/^[0-9a-f]{64}$/),
    action: z.enum(PROJECTION_ACTIONS),
    outcome: z.enum(['released', 'denied']),
    denialCode: z.string().min(1).max(64).optional(),
    fieldsReleased: z.array(z.string().min(1).max(512)).max(16384),
    fieldsRedacted: z.array(z.string().min(1).max(512)).max(16384),
    appliedScopes: AppliedScopesSchema,
    evaluationKey: z.string().regex(/^[0-9a-f]{64}$/),
    provenance: AuditProvenanceSchema,
    projectedAt: TimestampSchema,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedProjectionAudit',
    title: 'SealedProjectionAudit',
    description:
      'Published projection audit record: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed projection audit record. */
export type SealedProjectionAudit = z.infer<typeof SealedProjectionAuditSchema>;

// --------------------------------------------------------------------------------
// The evaluation key (replay discipline).
// --------------------------------------------------------------------------------

/** The inputs the evaluation key binds (everything but nothing else). */
export interface EvaluationKeyInputs {
  readonly tenantId: string;
  readonly principalId: string;
  readonly action: ProjectionAction;
  readonly policyDigest: string;
  readonly objectClass: ObjectClass;
  readonly objectId: string;
  readonly objectDigest: string;
  readonly decisionDigest: string;
  readonly taskClass?: string | undefined;
  readonly projectedAt: string;
}

/** Derive the evaluation key of one projection request (content-addressed). */
export function deriveEvaluationKey(inputs: EvaluationKeyInputs): Sha256Hex {
  return canonicalDigest({
    scope: EVALUATION_KEY_SCOPE,
    tenantId: inputs.tenantId,
    principalId: inputs.principalId,
    action: inputs.action,
    policyDigest: inputs.policyDigest,
    objectClass: inputs.objectClass,
    objectId: inputs.objectId,
    objectDigest: inputs.objectDigest,
    decisionDigest: inputs.decisionDigest,
    ...(inputs.taskClass !== undefined ? { taskClass: inputs.taskClass } : {}),
    projectedAt: inputs.projectedAt,
  } as unknown as JsonValue);
}

/** The deterministic audit id derived from one evaluation key. */
export function auditRecordIdOf(evaluationKey: Sha256Hex): string {
  return `audit:${evaluationKey.slice(0, 16)}`;
}

// --------------------------------------------------------------------------------
// Seal / verify.
// --------------------------------------------------------------------------------

/** Compute the content digest of a projection audit record. */
export function computeProjectionAuditDigest(content: ProjectionAuditContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid projection-audit content into its published record. */
export function sealProjectionAudit(
  content: unknown,
): AccessProjectionResult<SealedProjectionAudit> {
  const parsed = ProjectionAuditContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeProjectionAuditDigest(parsed.data) },
  };
}

/** Verify a sealed projection audit record: schema + recomputed digest. */
export function verifySealedProjectionAudit(
  sealed: unknown,
): AccessProjectionResult<SealedProjectionAudit> {
  const parsed = SealedProjectionAuditSchema.safeParse(sealed);
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
        message: `projection audit record "${parsed.data.auditId}" carries a tampered content digest`,
        expected: recomputed,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
