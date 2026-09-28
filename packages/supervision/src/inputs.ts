/**
 * The supervision EVALUATION INPUTS: the sealed W036 authorities
 * (ProgramOfWork + DeliveryRecord, embedded and verified at admission)
 * plus the OPAQUE typed references to the sibling-kernel states —
 * W038-shaped execution-issue summaries and W037-shaped lead-time risk
 * inputs — and the W036 information-acquisition requests carried
 * verbatim (a runtime edge on the solution-delivery kernel).
 *
 * Sibling-kernel inputs are SUPERVISION-SIDE MIRRORS (the W037
 * kernel-parity pattern): the shapes are structurally pinned to the
 * REAL W038/W037 records via devDependencies + compile-time parity
 * (src/kernel-parity.ts) + runtime parity tests — never runtime edges.
 */
import { z } from 'zod';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  InformationAcquisitionRequestSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  SolutionIdSchema,
  TimestampSchema,
  UncertaintyStateSchema,
  DistinctionRecordIdSchema,
  NonNegativeDecimalSchema,
} from '@epoch/solution-delivery';
import type { SealedDeliveryRecord, SealedProgramOfWork } from '@epoch/solution-delivery';
import { ActivityIdMirrorSchema } from './primitives';
import {
  EXECUTION_ISSUE_SUMMARY_SCHEMA_NAME,
  LEAD_TIME_RISK_INPUT_SCHEMA_NAME,
  SUPERVISION_RECORD_VERSION,
} from './version';
import { scanScheduleMutation } from './issues';
import { compareNonNegativeDecimals } from './decimal';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { SupervisionResult } from './errors';

// --------------------------------------------------------------------------------
// Execution-issue summaries (the W038 mirror — opaque typed references).
// --------------------------------------------------------------------------------

/** The closed issue-family mirror (W038 ISSUE_KINDS). */
export const ISSUE_SUMMARY_KINDS = ['change', 'delay', 'rework', 'defect', 'blocker'] as const;

/** One issue-summary kind. */
export type IssueSummaryKind = (typeof ISSUE_SUMMARY_KINDS)[number];

/** The closed issue-severity mirror (W038 ISSUE_SEVERITIES). */
export const ISSUE_SUMMARY_SEVERITIES = ['minor', 'moderate', 'major', 'critical'] as const;

/** One issue-summary severity. */
export type IssueSummarySeverity = (typeof ISSUE_SUMMARY_SEVERITIES)[number];

/** The closed resolution-state mirror (W038 RESOLUTION_STATES). */
export const ISSUE_SUMMARY_RESOLUTION_STATES = ['open', 'resolved', 'dismissed'] as const;

/** One issue-summary resolution state. */
export type IssueSummaryResolutionState = (typeof ISSUE_SUMMARY_RESOLUTION_STATES)[number];

/** The impact-reference mirror of one issue summary (opaque ProgramOfWork ids). */
export const IssueSummaryImpactSchema = z
  .strictObject({
    workPackageIds: z.array(z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/)).max(64),
    activityIds: z.array(ActivityIdMirrorSchema).max(256),
    milestoneIds: z.array(z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/)).max(64),
  })
  .readonly()
  .superRefine((impact, ctx) => {
    for (const field of ['workPackageIds', 'activityIds', 'milestoneIds'] as const) {
      const values = impact[field];
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
    id: 'IssueSummaryImpact',
    title: 'IssueSummaryImpact',
    description:
      'The impact-reference mirror of one execution-issue summary: the opaque ProgramOfWork schedule items (work packages, activities, milestones) the issue touches.',
  });

/** One issue-summary impact. */
export type IssueSummaryImpact = z.infer<typeof IssueSummaryImpactSchema>;

/** One execution-issue summary (the W038 record projected for supervision). */
export const ExecutionIssueSummarySchema = z
  .strictObject({
    schema: z.literal(EXECUTION_ISSUE_SUMMARY_SCHEMA_NAME),
    schemaVersion: z.literal(SUPERVISION_RECORD_VERSION),
    recordId: z.string().regex(/^(change|delay|rework|defect|blocker):[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    issueKind: z.enum(ISSUE_SUMMARY_KINDS),
    severity: z.enum(ISSUE_SUMMARY_SEVERITIES),
    resolutionState: z.enum(ISSUE_SUMMARY_RESOLUTION_STATES),
    impact: IssueSummaryImpactSchema,
    raisedAt: TimestampSchema,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'ExecutionIssueSummary',
    title: 'ExecutionIssueSummary',
    description:
      'One execution-issue summary: the W038 sealed issue record projected for supervision (exact digest reference, kind, severity, resolution state, opaque impact ids — never the payload).',
  });

/** One execution-issue summary. */
export type ExecutionIssueSummary = z.infer<typeof ExecutionIssueSummarySchema>;

/**
 * Admit one execution-issue summary: schedule-mutation vocabulary is a
 * typed `re-schedule-rejected` BEFORE validation; then the strict
 * schema with the vendor-field classifier.
 */
export function admitExecutionIssueSummary(input: unknown): SupervisionResult<ExecutionIssueSummary> {
  const mutation = scanScheduleMutation(input, typeof input === 'object' && input !== null && 'recordId' in input ? String((input as { recordId: unknown }).recordId) : 'execution-issue-summary');
  if (mutation !== null) {
    return { ok: false, error: mutation };
  }
  const parsed = ExecutionIssueSummarySchema.safeParse(input);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Lead-time risk inputs (the W037 mirror — opaque typed references).
// --------------------------------------------------------------------------------

/** The exact-revision source-record reference of one lead-time input (the W037 lead-time observation shape). */
export const LeadTimeSourceRecordSchema = z
  .strictObject({
    recordId: DistinctionRecordIdSchema,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'LeadTimeSourceRecord',
    title: 'LeadTimeSourceRecord',
    description:
      'The exact-revision Prediction/Estimate distinction-record reference a lead-time risk input resolves (the W037 lead-time observation shape, mirrored).',
  });

/** One lead-time source record. */
export type LeadTimeSourceRecord = z.infer<typeof LeadTimeSourceRecordSchema>;

/** One acquisition/lead-time risk input. */
export const LeadTimeRiskInputSchema = z
  .strictObject({
    schema: z.literal(LEAD_TIME_RISK_INPUT_SCHEMA_NAME),
    schemaVersion: z.literal(SUPERVISION_RECORD_VERSION),
    leadTimeInputId: z.string().regex(/^lead-time:[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    acquisitionRef: OpaqueReferenceSchema,
    requiredBy: TimestampSchema,
    realisticLeadTimeDays: NonNegativeDecimalSchema,
    observedAt: TimestampSchema,
    sourceRecord: LeadTimeSourceRecordSchema,
    uncertainty: UncertaintyStateSchema,
    impactedActivityIds: z.array(ActivityIdMirrorSchema).max(64),
  })
  .readonly()
  .superRefine((input, ctx) => {
    for (let i = 1; i < input.impactedActivityIds.length; i += 1) {
      if (input.impactedActivityIds[i]! < input.impactedActivityIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'impactedActivityIds must be sorted ascending (deterministic serialization)',
          path: ['impactedActivityIds'],
        });
        break;
      }
      if (input.impactedActivityIds[i]! === input.impactedActivityIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'impactedActivityIds must be duplicate-free',
          path: ['impactedActivityIds'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'LeadTimeRiskInput',
    title: 'LeadTimeRiskInput',
    description:
      'One acquisition/lead-time risk input: the opaque acquisition reference, the prerequisite need instant, the realistic lead time in days with its exact-revision source record and mandatory uncertainty, and the downstream activities it threatens.',
  });

/** One lead-time risk input. */
export type LeadTimeRiskInput = z.infer<typeof LeadTimeRiskInputSchema>;

/**
 * Admit one lead-time risk input: schedule-mutation vocabulary is a
 * typed `re-schedule-rejected` BEFORE validation; then the strict
 * schema with the vendor-field classifier.
 */
export function admitLeadTimeRiskInput(input: unknown): SupervisionResult<LeadTimeRiskInput> {
  const mutation = scanScheduleMutation(input, typeof input === 'object' && input !== null && 'leadTimeInputId' in input ? String((input as { leadTimeInputId: unknown }).leadTimeInputId) : 'lead-time-risk-input');
  if (mutation !== null) {
    return { ok: false, error: mutation };
  }
  const parsed = LeadTimeRiskInputSchema.safeParse(input);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Consumption/cost anomaly thresholds (typed, versioned rule data).
// --------------------------------------------------------------------------------

/** The typed threshold rules of consumption/cost anomaly checks. */
export const SupervisionThresholdsSchema = z
  .strictObject({
    quantityOverrunRatio: NonNegativeDecimalSchema,
    costOverrunRatio: NonNegativeDecimalSchema,
    quantityUnderrunRatio: NonNegativeDecimalSchema,
    costUnderrunRatio: NonNegativeDecimalSchema,
  })
  .readonly()
  .superRefine((thresholds, ctx) => {
    if (compareNonNegativeDecimals(thresholds.quantityOverrunRatio, '1') < 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'quantityOverrunRatio must be >= 1 (an overrun threshold at or above parity)',
        path: ['quantityOverrunRatio'],
      });
    }
    if (compareNonNegativeDecimals(thresholds.costOverrunRatio, '1') < 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'costOverrunRatio must be >= 1 (an overrun threshold at or above parity)',
        path: ['costOverrunRatio'],
      });
    }
    if (compareNonNegativeDecimals(thresholds.quantityUnderrunRatio, '1') > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'quantityUnderrunRatio must be <= 1 (an underrun threshold at or below parity)',
        path: ['quantityUnderrunRatio'],
      });
    }
    if (compareNonNegativeDecimals(thresholds.costUnderrunRatio, '1') > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'costUnderrunRatio must be <= 1 (an underrun threshold at or below parity)',
        path: ['costUnderrunRatio'],
      });
    }
  })
  .meta({
    id: 'SupervisionThresholds',
    title: 'SupervisionThresholds',
    description:
      'The typed threshold rules of consumption/cost anomaly checks: exact decimal overrun ratios (>= 1) and underrun ratios (<= 1) applied to the W036 foldDeliveryActuals shapes.',
  });

/** One thresholds block. */
export type SupervisionThresholds = z.infer<typeof SupervisionThresholdsSchema>;

/** The default thresholds (10% over/under parity — documented, overridable data). */
export const DEFAULT_SUPERVISION_THRESHOLDS: SupervisionThresholds = {
  quantityOverrunRatio: '1.10',
  costOverrunRatio: '1.10',
  quantityUnderrunRatio: '0.90',
  costUnderrunRatio: '0.90',
} as const;

// --------------------------------------------------------------------------------
// The total evaluation input.
// --------------------------------------------------------------------------------

/** The total input of one supervision evaluation pass. */
export const SupervisionEvaluationInputSchema = z
  .strictObject({
    passId: z.string().regex(/^pass:[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    evaluatedAt: TimestampSchema,
    evaluatedBy: PrincipalIdSchema,
    program: z.custom<SealedProgramOfWork>(),
    delivery: z.custom<SealedDeliveryRecord>(),
    thresholds: SupervisionThresholdsSchema,
    executionIssues: z.array(z.custom<ExecutionIssueSummary>()).max(512),
    leadTimeInputs: z.array(z.custom<LeadTimeRiskInput>()).max(256),
    infoRequests: z.array(InformationAcquisitionRequestSchema).max(256),
  })
  .readonly()
  .meta({
    id: 'SupervisionEvaluationInput',
    title: 'SupervisionEvaluationInput',
    description:
      'The total input of one supervision evaluation pass: identity, tenant scope, the evaluation instant and principal, the sealed W036 authorities, the typed thresholds, and the opaque sibling-kernel input references.',
  });

/** One evaluation input. */
export type SupervisionEvaluationInput = z.infer<typeof SupervisionEvaluationInputSchema>;

/** Re-exported W036 types used by the input surface (one-stop consumption). */
export type { SealedProgramOfWork, SealedDeliveryRecord, InformationAcquisitionRequest } from '@epoch/solution-delivery';
