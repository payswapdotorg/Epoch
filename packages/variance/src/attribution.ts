/**
 * ROOT-CAUSE ATTRIBUTION WITH EVIDENCE (the W039 pin): typed attribution
 * records linking a variance to its CAUSE — a change record, a W038
 * issue record, or an external condition — by W006-convention evidence
 * references.
 *
 * - ATTRIBUTION WITHOUT EVIDENCE IS INEXPRESSIBLE: an attribution whose
 *   evidence array is empty is a typed `attribution-evidence-required`
 *   rejection (the named test) — root cause claims are always grounded
 *   in exact-revision evidence digests.
 * - Cause references are OPAQUE typed record ids with per-kind grammars
 *   (the W038 issue-id grammar for change/issue records); never embedded
 *   objects, never vendor vocabulary.
 * - The attribution binds the variance record by EXACT revision (record
 *   id + content digest); the same attribution id with different content
 *   is a typed `version-conflict` (sealed records are immutable).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  AttributionIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  TimestampSchema,
  VarianceRecordRefSchema,
} from './primitives';
import {
  ATTRIBUTION_RECORD_SCHEMA_NAME,
  VARIANCE_RECORD_VERSION,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { VarianceResult } from './errors';

// --------------------------------------------------------------------------------
// Cause references (opaque typed ids with per-kind grammars).
// --------------------------------------------------------------------------------

/**
 * One cause reference — the W038 issue-record id grammar for
 * change/issue records (change:/delay:/rework:/defect:/blocker:), and a
 * bounded opaque reference for external conditions.
 */
export const CauseRefSchema = z
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
    id: 'CauseRef',
    title: 'CauseRef',
    description:
      'One cause reference: the cause kind (change record, W038 issue record, external condition), its opaque record id, and the exact content digest of that revision.',
  });

/** One cause reference. */
export type CauseRef = z.infer<typeof CauseRefSchema>;

// --------------------------------------------------------------------------------
// The attribution record.
// --------------------------------------------------------------------------------

/**
 * The immutable content of one attribution record: the variance it
 * explains (exact revision), its cause (opaque typed reference), the
 * MANDATORY sorted evidence digests, and the attribution provenance.
 */
const attributionRecordShape = z.strictObject({
  schema: z.literal(ATTRIBUTION_RECORD_SCHEMA_NAME),
  schemaVersion: z.literal(VARIANCE_RECORD_VERSION),
  attributionId: AttributionIdSchema,
  tenantId: TenantIdSchema,
  solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
  varianceRef: VarianceRecordRefSchema,
  cause: CauseRefSchema,
  evidence: z.array(Sha256HexSchema).max(64),
  note: z.string().max(2048).optional(),
  attributedAt: TimestampSchema,
  attributedBy: PrincipalIdSchema,
});

export const AttributionRecordContentSchema = attributionRecordShape
  .readonly()
  .superRefine((attribution, ctx) => {
    // ATTRIBUTION WITHOUT EVIDENCE IS INEXPRESSIBLE (the typed guard the
    // schema cannot express as a plain shape — the named test pins it).
    if (attribution.evidence.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message:
          'a root-cause attribution carries at least one W006-convention evidence digest — attribution without evidence is inexpressible (attribution-evidence-required)',
        path: ['evidence'],
      });
    }
    for (let i = 1; i < attribution.evidence.length; i += 1) {
      if (attribution.evidence[i]! < attribution.evidence[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'evidence must be sorted ascending (deterministic serialization)',
          path: ['evidence'],
        });
        break;
      }
      if (attribution.evidence[i]! === attribution.evidence[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'evidence must be duplicate-free',
          path: ['evidence'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'AttributionRecordContent',
    title: 'AttributionRecordContent',
    description:
      'The immutable content of one attribution record: the explained variance (exact revision), its cause (change record / W038 issue / external condition, opaque typed reference), the MANDATORY sorted evidence digests, and the attribution provenance.',
  });

/** One attribution-record content. */
export type AttributionRecordContent = z.infer<typeof AttributionRecordContentSchema>;

/** The SEALED attribution record: content plus its SHA-256 content digest. */
export const SealedAttributionRecordSchema = z
  .strictObject({
    ...attributionRecordShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedAttributionRecord',
    title: 'SealedAttributionRecord',
    description:
      'The sealed attribution record: immutable content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed attribution record. */
export type SealedAttributionRecord = z.infer<typeof SealedAttributionRecordSchema>;

/** Compute the content digest of an attribution-record content (canonical JSON). */
export function computeAttributionRecordDigest(content: AttributionRecordContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid attribution-record content into its published record. */
export function sealAttributionRecord(content: unknown): VarianceResult<SealedAttributionRecord> {
  const parsed = AttributionRecordContentSchema.safeParse(content);
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
 * Verify a sealed attribution record: schema validation (including the
 * evidence-required refinement) + digest recomputation (tamper
 * detection — `digest-mismatch`).
 */
export function verifySealedAttributionRecord(
  sealed: unknown,
): VarianceResult<SealedAttributionRecord> {
  const parsed = SealedAttributionRecordSchema.safeParse(sealed);
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
          'sealed attribution record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The typed evidence-required pre-classifier (the named guard).
// --------------------------------------------------------------------------------

/**
 * The typed `attribution-evidence-required` guard: an attribution whose
 * evidence array is empty is rejected BEFORE schema validation (the
 * marketplace pricing pre-classification pattern) — the named-test
 * surface for callers that build attribution content dynamically.
 */
export function requireAttributionEvidence(content: unknown): VarianceResult<null> {
  const asRecord = content as
    | {
        evidence?: unknown;
        attributionId?: unknown;
        varianceRef?: { recordId?: unknown } | null;
      }
    | null
    | undefined;
  if (
    asRecord !== null &&
    typeof asRecord === 'object' &&
    Array.isArray(asRecord.evidence) &&
    asRecord.evidence.length === 0
  ) {
    return {
      ok: false,
      error: {
        code: 'attribution-evidence-required',
        message: `attribution "${String(asRecord.attributionId)}" carries no evidence — root-cause attribution without W006-convention evidence references is inexpressible`,
        varianceRecordId:
          asRecord.varianceRef !== null &&
          typeof asRecord.varianceRef === 'object' &&
          typeof asRecord.varianceRef?.recordId === 'string'
            ? asRecord.varianceRef.recordId
            : '',
        evidenceCount: 0,
      },
    };
  }
  return { ok: true, value: null };
}

// --------------------------------------------------------------------------------
// The append-only attribution ledger (reference in-memory).
// --------------------------------------------------------------------------------

/** The state of one attribution ledger after admissions. */
export interface AttributionLedger {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly records: readonly SealedAttributionRecord[];
}

/** An empty attribution ledger for one (tenant, solution) scope. */
export function openAttributionLedger(scope: {
  readonly tenantId: string;
  readonly solutionId: string;
}): AttributionLedger {
  return { tenantId: scope.tenantId, solutionId: scope.solutionId, records: [] };
}

/**
 * Admit a sealed attribution record into the ledger (append-only): the
 * record verifies (tamper detection + the evidence-required refinement),
 * the tenant/solution scope must match, the referenced variance must
 * resolve in the caller-supplied variance ledger (dangling references
 * are typed `dangling-reference-rejected`), an exact re-admission is
 * idempotent, and the same id with different content is a typed
 * `version-conflict`.
 */
export function admitAttributionRecord(
  ledger: AttributionLedger,
  variances: readonly { varianceId: string; contentDigest: string; tenantId: string; solutionId: string }[],
  record: unknown,
): VarianceResult<AttributionLedger> {
  const verified = verifySealedAttributionRecord(record);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== ledger.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `attribution record "${admitted.attributionId}" belongs to tenant "${admitted.tenantId}" but the ledger is scoped to "${ledger.tenantId}" (R12)`,
        expectedTenantId: ledger.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.attributionId,
      },
    };
  }
  if (admitted.solutionId !== ledger.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `attribution record "${admitted.attributionId}" subjects solution "${admitted.solutionId}" but the ledger is scoped to "${ledger.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'attribution/ledger solution mismatch' }],
      },
    };
  }
  const variance = variances.find(
    (candidate) => candidate.varianceId === admitted.varianceRef.recordId,
  );
  if (variance === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `attribution record "${admitted.attributionId}" explains variance "${admitted.varianceRef.recordId}", which does not resolve in the supplied variance ledger`,
        referenceKind: 'variance-record',
        referenceId: admitted.varianceRef.recordId,
      },
    };
  }
  if (variance.contentDigest !== admitted.varianceRef.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `attribution record "${admitted.attributionId}" binds variance revision digest ${admitted.varianceRef.contentDigest.slice(0, 8)}… but the resolved variance carries ${variance.contentDigest.slice(0, 8)}… (stale or tampered binding)`,
        expected: variance.contentDigest,
        encountered: admitted.varianceRef.contentDigest,
      },
    };
  }
  const existing = ledger.records.find((record) => record.attributionId === admitted.attributionId);
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: ledger };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `attribution record "${admitted.attributionId}" is already sealed with different content — a sealed attribution record is immutable; changed content ships as a NEW attribution id`,
        subject: 'attribution-record',
        subjectId: admitted.attributionId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return { ok: true, value: { ...ledger, records: [...ledger.records, admitted] } };
}

/** The ledger fold: records sorted by attributionId (deterministic). */
export function foldAttributionRecords(
  ledger: AttributionLedger,
): readonly SealedAttributionRecord[] {
  return [...ledger.records].sort((a, b) => (a.attributionId < b.attributionId ? -1 : 1));
}

/**
 * The attributed causes of one variance, sorted by attribution id — the
 * explainability view (input order never leaks).
 */
export function causesOf(
  ledger: AttributionLedger,
  varianceId: string,
): readonly SealedAttributionRecord[] {
  return foldAttributionRecords(ledger).filter(
    (record) => record.varianceRef.recordId === varianceId,
  );
}
