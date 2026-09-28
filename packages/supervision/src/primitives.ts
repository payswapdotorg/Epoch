/**
 * Supervision primitives: the package-local id grammars plus the shared
 * W036 primitive schemas re-exported for one-stop typed consumption (the
 * W038 pattern — the solution-delivery kernel owns the grammars;
 * supervision mirrors them, never re-declares them).
 */
import {
  FINDING_ID_PATTERN,
  LEAD_TIME_INPUT_ID_PATTERN,
  ISSUE_SUMMARY_ID_PATTERN,
  SUBJECT_KIND_TOKEN_PATTERN,
  SUPERVISION_PASS_ID_PATTERN,
  SUPERVISION_PRINCIPAL_ID_PATTERN,
  SUPERVISION_STREAM_ID_PATTERN,
  FINDING_CLASS_TOKEN_PATTERN,
} from './version';
import { z } from 'zod';

// --------------------------------------------------------------------------------
// Package-local id grammars.
// --------------------------------------------------------------------------------

/** Finding id (`finding:<slug>`). */
export const FindingIdSchema = z.string().regex(FINDING_ID_PATTERN).meta({
  id: 'FindingId',
  title: 'FindingId',
  description: 'Opaque supervision-finding identity: "finding:<slug>", derived deterministically from the finding class and subject.',
});

/** One finding id. */
export type FindingId = z.infer<typeof FindingIdSchema>;

/** Supervision-pass id (`pass:<slug>`). */
export const SupervisionPassIdSchema = z.string().regex(SUPERVISION_PASS_ID_PATTERN).meta({
  id: 'SupervisionPassId',
  title: 'SupervisionPassId',
  description: 'Opaque supervision-pass identity: "pass:<slug>", caller-supplied.',
});

/** One supervision-pass id. */
export type SupervisionPassId = z.infer<typeof SupervisionPassIdSchema>;

/** Supervision stream id (`stream:supervision-<suffix>`). */
export const SupervisionStreamIdSchema = z.string().regex(SUPERVISION_STREAM_ID_PATTERN).meta({
  id: 'SupervisionStreamId',
  title: 'SupervisionStreamId',
  description: 'Opaque supervision-stream identity: "stream:supervision-<suffix>" (one stream per supervised program).',
});

/** One supervision stream id. */
export type SupervisionStreamId = z.infer<typeof SupervisionStreamIdSchema>;

/** Supervision principal id (the W009 principal grammar, mirrored). */
export const SupervisionPrincipalIdSchema = z
  .string()
  .regex(SUPERVISION_PRINCIPAL_ID_PATTERN)
  .meta({
    id: 'SupervisionPrincipalId',
    title: 'SupervisionPrincipalId',
    description: 'Opaque acting principal of the supervision domain: "principal:<slug>" (the W009 grammar).',
  });

/** One supervision principal id. */
export type SupervisionPrincipalId = z.infer<typeof SupervisionPrincipalIdSchema>;

/** Execution-issue summary id (the W038 issue families, mirrored). */
export const IssueSummaryIdSchema = z.string().regex(ISSUE_SUMMARY_ID_PATTERN).meta({
  id: 'IssueSummaryId',
  title: 'IssueSummaryId',
  description: 'Opaque execution-issue summary identity mirroring the W038 families: "change:|delay:|rework:|defect:|blocker:<slug>".',
});

/** One issue-summary id. */
export type IssueSummaryId = z.infer<typeof IssueSummaryIdSchema>;

/** Lead-time risk input id (`lead-time:<slug>`). */
export const LeadTimeInputIdSchema = z.string().regex(LEAD_TIME_INPUT_ID_PATTERN).meta({
  id: 'LeadTimeInputId',
  title: 'LeadTimeInputId',
  description: 'Opaque lead-time risk input identity: "lead-time:<slug>".',
});

/** One lead-time input id. */
export type LeadTimeInputId = z.infer<typeof LeadTimeInputIdSchema>;

/** A neutral finding-class token (also the @epoch/alerts policy rule key). */
export const FindingClassTokenSchema = z.string().regex(FINDING_CLASS_TOKEN_PATTERN).meta({
  id: 'FindingClassToken',
  title: 'FindingClassToken',
  description: 'A neutral finding-class token: kebab-case, bounded (the closed vocabulary lives in FINDING_CLASSES).',
});

/** One finding-class token. */
export type FindingClassToken = z.infer<typeof FindingClassTokenSchema>;

/** A neutral subject-kind token. */
export const SubjectKindTokenSchema = z.string().regex(SUBJECT_KIND_TOKEN_PATTERN).meta({
  id: 'SubjectKindToken',
  title: 'SubjectKindToken',
  description: 'A neutral subject-kind token: kebab-case, bounded (the closed vocabulary lives in FINDING_SUBJECT_KINDS).',
});

/** One subject-kind token. */
export type SubjectKindToken = z.infer<typeof SubjectKindTokenSchema>;

/**
 * Activity identity — MIRRORED from the W036 `ACTIVITY_ID_PATTERN`
 * grammar (`activity:<slug>`; the solution-delivery index exports the
 * TYPE but not the schema, so this mirrors the W038 precedent); pinned
 * by the runtime parity test (REAL W036 activity ids validate through
 * this grammar and vice versa).
 */
export const ActivityIdMirrorSchema = z
  .string()
  .regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/, 'must be an activity id of the form "activity:<slug>"')
  .meta({
    id: 'ActivityId',
    title: 'ActivityId',
    description:
      'Opaque activity identity: "activity:" followed by a lowercase slug (the W036 ProgramOfWork grammar).',
  });

/** One activity id (the W036 grammar, mirrored). */
export type ActivityIdMirror = z.infer<typeof ActivityIdMirrorSchema>;

// --------------------------------------------------------------------------------
// W036 primitives re-exported (the grammars stay the solution-delivery
// kernel's — supervision consumes them verbatim).
// --------------------------------------------------------------------------------

export {
  BlockerIdSchema,
  CurrencyCodeSchema,
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  GateIdSchema,
  InfoRequestIdSchema,
  MilestoneIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  ProgramIdSchema,
  ProgressFractionSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
} from '@epoch/solution-delivery';

export type {
  ActivityId as W036ActivityId,
  BlockerId,
  CurrencyCode,
  DeliveryId,
  DistinctionRecordId,
  GateId,
  InfoRequestId,
  MilestoneId,
  NonNegativeDecimal,
  OpaqueReference,
  PrincipalId,
  ProgramId,
  ProgressFraction,
  SemverCore,
  Sha256Hex,
  SolutionId,
  Timestamp,
  UnitLabel,
  WorkPackageId,
} from '@epoch/solution-delivery';

export { TenantIdSchema } from '@epoch/tenancy';
export type { TenantId } from '@epoch/tenancy';

export { canonicalDigest, sha256Hex } from '@epoch/agent-protocol';
export type { JsonValue, Sha256Hex as CanonicalSha256Hex } from '@epoch/agent-protocol';
