/**
 * CHANGES, DELAYS, REWORK, DEFECTS AND BLOCKERS (W038 pin): typed record
 * families with severity + impact references (which schedule items they
 * touch, by opaque id) + resolution state; rework references the ORIGINAL
 * work records; blockers carry dependency semantics (what is blocked and
 * why).
 *
 * - One id prefix per family (`change:`, `delay:`, `rework:`, `defect:`,
 *   `blocker:` — the prefix MUST match the `issueKind`);
 * - impact references are OPAQUE ProgramOfWork ids (work packages,
 *   activities, milestones), sorted and duplicate-free; resolution
 *   against the tracking store's program index catches dangling
 *   references;
 * - REWORK carries a mandatory `reworkOf` reference to the original work
 *   records (work package / activity / prior tracking record);
 * - BLOCKERS carry mandatory dependency semantics: what is blocked
 *   (subject) and why (an opaque blocked-by reference plus a reason);
 * - the RESOLUTION STATE is append-only: an issue is `open` until
 *   exactly one {@link SealedIssueResolutionRecord} settles it
 *   (`resolved` or `dismissed`) — a second resolution is a typed
 *   `lifecycle-conflict`; history is never rewritten;
 * - every issue carries the mandatory uncertainty state and sorted
 *   field-evidence references.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  MilestoneIdSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  WorkPackageIdSchema,
} from '@epoch/solution-delivery';
import { TenantIdSchema } from '@epoch/solution-delivery';
import { UncertaintyStateSchema } from '@epoch/solution-delivery';
import { ActivityIdSchema, IssueRecordIdSchema, IssueResolutionIdSchema, StateIdSchema } from './primitives';
import {
  EXECUTION_TRACKING_RECORD_VERSION,
  ISSUE_KINDS,
  ISSUE_RESOLUTIONS,
  ISSUE_RECORD_SCHEMA_NAME,
  ISSUE_RESOLUTION_SCHEMA_NAME,
  ISSUE_SEVERITIES,
  kindPrefixOf,
  type ResolutionState,
} from './version';
import {
  FieldEvidenceLinkArraySchema,
  refineSortedEvidenceLinks,
} from './field-evidence';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ExecutionResult } from './errors';

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

/** The impact reference set: which schedule items the issue touches (opaque ids). */
export const IssueImpactSchema = z
  .strictObject({
    workPackageIds: z.array(WorkPackageIdSchema).max(64),
    activityIds: z.array(ActivityIdSchema).max(256),
    milestoneIds: z.array(MilestoneIdSchema).max(64),
  })
  .readonly()
  .superRefine((impact, ctx) => {
    refineSortedStrings(impact.workPackageIds, ctx, 'workPackageIds');
    refineSortedStrings(impact.activityIds, ctx, 'activityIds');
    refineSortedStrings(impact.milestoneIds, ctx, 'milestoneIds');
  })
  .meta({
    id: 'IssueImpact',
    title: 'IssueImpact',
    description:
      'The impact reference set of one execution issue: the opaque ProgramOfWork schedule items (work packages, activities, milestones) it touches.',
  });

/** One issue impact reference set. */
export type IssueImpact = z.infer<typeof IssueImpactSchema>;

/** The rework provenance: the ORIGINAL work records the rework redoes. */
export const ReworkReferenceSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    activityId: ActivityIdSchema.optional(),
    originalTrackingRecordId: StateIdSchema.optional(),
    reason: z.string().min(1).max(2048),
  })
  .readonly()
  .meta({
    id: 'ReworkReference',
    title: 'ReworkReference',
    description:
      'Rework provenance: the original work records (work package, optional activity, optional prior tracking record) the rework redoes, plus the reason.',
  });

/** One rework reference. */
export type ReworkReference = z.infer<typeof ReworkReferenceSchema>;

/** The blocker dependency semantics: what is blocked, by what, and why. */
export const BlockerSemanticsSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    activityId: ActivityIdSchema.optional(),
    blockedByRef: OpaqueReferenceSchema,
    reason: z.string().min(1).max(2048),
  })
  .readonly()
  .meta({
    id: 'BlockerSemantics',
    title: 'BlockerSemantics',
    description:
      'Blocker dependency semantics: the blocked subject (work package, optional activity), the opaque blocked-by reference, and the reason it is blocked.',
  });

/** One blocker semantics. */
export type BlockerSemantics = z.infer<typeof BlockerSemanticsSchema>;

/**
 * The immutable content of one execution-issue record (change, delay,
 * rework, defect, or blocker). The recordId prefix MUST match the
 * issueKind; `reworkOf` is mandatory for rework; `blocked` is mandatory
 * for blockers; the impact reference set must be non-empty.
 */
export const IssueRecordContentSchema = z
  .strictObject({
    schema: z.literal(ISSUE_RECORD_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: IssueRecordIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    issueKind: z.enum(ISSUE_KINDS),
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    severity: z.enum(ISSUE_SEVERITIES),
    impact: IssueImpactSchema,
    reworkOf: ReworkReferenceSchema.optional(),
    blocked: BlockerSemanticsSchema.optional(),
    raisedAt: TimestampSchema,
    raisedBy: PrincipalIdSchema,
    recordedAt: TimestampSchema,
    evidenceLinks: FieldEvidenceLinkArraySchema,
    uncertainty: UncertaintyStateSchema,
  })
  .readonly()
  .superRefine((record, ctx) => {
    refineSortedEvidenceLinks(record.evidenceLinks, ctx, 'evidenceLinks');
    if (kindPrefixOf(record.recordId) !== record.issueKind) {
      ctx.addIssue({
        code: 'custom',
        message: `record id "${record.recordId}" must carry the "${record.issueKind}:" family prefix`,
        path: ['recordId'],
      });
    }
    if (record.issueKind === 'rework' && record.reworkOf === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a rework record MUST reference the original work records (reworkOf)',
        path: ['reworkOf'],
      });
    }
    if (record.issueKind === 'blocker' && record.blocked === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a blocker record MUST carry dependency semantics (blocked: what is blocked and why)',
        path: ['blocked'],
      });
    }
    if (
      record.impact.workPackageIds.length === 0 &&
      record.impact.activityIds.length === 0 &&
      record.impact.milestoneIds.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'an issue must reference at least one impacted schedule item',
        path: ['impact'],
      });
    }
    if (record.recordedAt < record.raisedAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'recordedAt must not precede raisedAt',
        path: ['recordedAt'],
      });
    }
  })
  .meta({
    id: 'IssueRecordContent',
    title: 'IssueRecordContent',
    description:
      'The immutable content of one execution-issue record (change/delay/rework/defect/blocker): kind-prefixed id, severity, impact references (opaque ProgramOfWork ids), rework provenance or blocker dependency semantics where mandated, provenance, sorted field-evidence references, and the mandatory uncertainty state.',
  });

/** One execution-issue record content. */
export type IssueRecordContent = z.infer<typeof IssueRecordContentSchema>;

/** The SEALED execution-issue record: content plus its SHA-256 content digest. */
export const SealedIssueRecordSchema = z
  .strictObject({
    schema: z.literal(ISSUE_RECORD_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: IssueRecordIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    issueKind: z.enum(ISSUE_KINDS),
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    severity: z.enum(ISSUE_SEVERITIES),
    impact: IssueImpactSchema,
    reworkOf: ReworkReferenceSchema.optional(),
    blocked: BlockerSemanticsSchema.optional(),
    raisedAt: TimestampSchema,
    raisedBy: PrincipalIdSchema,
    recordedAt: TimestampSchema,
    evidenceLinks: FieldEvidenceLinkArraySchema,
    uncertainty: UncertaintyStateSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedIssueRecord',
    title: 'SealedIssueRecord',
    description:
      'The sealed execution-issue record: immutable change/delay/rework/defect/blocker content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed execution-issue record. */
export type SealedIssueRecord = z.infer<typeof SealedIssueRecordSchema>;

/** Compute the content digest of an execution-issue record content. */
export function computeIssueRecordDigest(content: IssueRecordContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid execution-issue record content into its published record. */
export function sealIssueRecord(content: unknown): ExecutionResult<SealedIssueRecord> {
  const parsed = IssueRecordContentSchema.safeParse(content);
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
 * Verify a sealed execution-issue record: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedIssueRecord(sealed: unknown): ExecutionResult<SealedIssueRecord> {
  const parsed = SealedIssueRecordSchema.safeParse(sealed);
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
          'sealed execution-issue record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Issue resolutions (append-only; the resolution state is derived).
// --------------------------------------------------------------------------------

/**
 * The immutable content of one issue-resolution record: exactly one
 * resolution per issue (`resolved` or `dismissed`), with provenance and
 * evidence.
 */
export const IssueResolutionContentSchema = z
  .strictObject({
    schema: z.literal(ISSUE_RESOLUTION_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: IssueResolutionIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    issueRecordId: IssueRecordIdSchema,
    resolution: z.enum(ISSUE_RESOLUTIONS),
    resolvedAt: TimestampSchema,
    resolvedBy: PrincipalIdSchema,
    note: z.string().max(2048).optional(),
    evidenceLinks: FieldEvidenceLinkArraySchema,
  })
  .readonly()
  .superRefine((record, ctx) => {
    refineSortedEvidenceLinks(record.evidenceLinks, ctx, 'evidenceLinks');
  })
  .meta({
    id: 'IssueResolutionContent',
    title: 'IssueResolutionContent',
    description:
      'The immutable content of one issue-resolution record: the settled issue, the resolution decision (resolved or dismissed), provenance, note, and sorted field-evidence references.',
  });

/** One issue-resolution content. */
export type IssueResolutionContent = z.infer<typeof IssueResolutionContentSchema>;

/** The SEALED issue-resolution record: content plus its SHA-256 content digest. */
export const SealedIssueResolutionSchema = z
  .strictObject({
    schema: z.literal(ISSUE_RESOLUTION_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: IssueResolutionIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    issueRecordId: IssueRecordIdSchema,
    resolution: z.enum(ISSUE_RESOLUTIONS),
    resolvedAt: TimestampSchema,
    resolvedBy: PrincipalIdSchema,
    note: z.string().max(2048).optional(),
    evidenceLinks: FieldEvidenceLinkArraySchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedIssueResolution',
    title: 'SealedIssueResolution',
    description:
      'The sealed issue-resolution record: immutable content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed issue-resolution record. */
export type SealedIssueResolution = z.infer<typeof SealedIssueResolutionSchema>;

/** Compute the content digest of an issue-resolution content. */
export function computeIssueResolutionDigest(content: IssueResolutionContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid issue-resolution content into its published record. */
export function sealIssueResolution(content: unknown): ExecutionResult<SealedIssueResolution> {
  const parsed = IssueResolutionContentSchema.safeParse(content);
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
 * Verify a sealed issue-resolution record: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedIssueResolution(
  sealed: unknown,
): ExecutionResult<SealedIssueResolution> {
  const parsed = SealedIssueResolutionSchema.safeParse(sealed);
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
          'sealed issue-resolution record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Deterministic issue folds (open / resolved / dismissed).
// --------------------------------------------------------------------------------

/** One folded issue with its derived resolution state. */
export interface FoldedIssue {
  readonly issue: SealedIssueRecord;
  readonly resolution: SealedIssueResolution | null;
  readonly resolutionState: ResolutionState;
}

/**
 * Fold issues with their (at most one) resolution: `open` until exactly
 * one resolution record settles the issue. Rows sort by issue recordId;
 * input order never leaks.
 */
export function foldIssues(
  issues: readonly SealedIssueRecord[],
  resolutions: readonly SealedIssueResolution[],
): readonly FoldedIssue[] {
  const byIssue = new Map<string, SealedIssueResolution>();
  for (const resolution of [...resolutions].sort((a, b) =>
    a.recordId < b.recordId ? -1 : 1,
  )) {
    if (!byIssue.has(resolution.issueRecordId)) {
      byIssue.set(resolution.issueRecordId, resolution);
    }
  }
  return [...issues]
    .sort((a, b) => (a.recordId < b.recordId ? -1 : 1))
    .map((issue) => {
      const resolution = byIssue.get(issue.recordId) ?? null;
      const resolutionState: ResolutionState =
        resolution === null ? 'open' : resolution.resolution === 'resolved' ? 'resolved' : 'dismissed';
      return { issue, resolution, resolutionState };
    });
}
