/**
 * Provider-neutral zod primitives of the solution-delivery kernel. Every
 * schema here is a JSON-representable data shape; no field encodes a
 * vendor, brand, marketplace, ERP, PM tool, or API surface (architecture
 * lock rule 13).
 *
 * Composition policy (the W010/W023 runtime-composition precedent): digest
 * machinery, timestamps, the JSON value space, semver, qualified names and
 * the money primitives (ISO 4217 currency codes, non-negative decimal
 * amounts) are REUSED from @epoch/agent-protocol; tenant ids are REUSED
 * from @epoch/tenancy (genuine runtime composition — the W009 grammar,
 * never a mirror). The principal, stream and event-record-version grammars
 * are MIRRORED from @epoch/event-log and pinned by runtime parity tests
 * (the kernel-to-kernel devDependency precedent).
 */
import { z } from 'zod';
import {
  ISO_CURRENCY_PATTERN,
  NON_NEGATIVE_DECIMAL_PATTERN,
  QUALIFIED_NAME_PATTERN,
  SEMVER_CORE_PATTERN,
  TimestampSchema,
} from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  ACQUISITION_ID_PATTERN,
  ACTIVITY_ID_PATTERN,
  BASELINE_APPROVAL_ID_PATTERN,
  BLOCKER_ID_PATTERN,
  DELIVERY_ID_PATTERN,
  DELIVERY_PRINCIPAL_ID_PATTERN,
  DELIVERY_STREAM_ID_PATTERN,
  DISTINCTION_ID_PATTERN,
  EXTERNAL_EVENT_ID_PATTERN,
  EXTERNAL_REQUEST_ID_PATTERN,
  GATE_ID_PATTERN,
  INFO_REQUEST_ID_PATTERN,
  MILESTONE_ID_PATTERN,
  PROGRAM_ID_PATTERN,
  SOLUTION_ID_PATTERN,
  SOLUTION_LINE_ID_PATTERN,
  STAGE_RECORD_ID_PATTERN,
  TRANSITION_RECORD_ID_PATTERN,
  WORK_PACKAGE_ID_PATTERN,
} from './version';

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** SHA-256 content digest as lowercase hex (the exact-revision address form). */
export const Sha256HexSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Hex',
    title: 'Sha256Hex',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** SHA-256 digest string type. */
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;

/** Solution package identity: `solution:<slug>`, stable across versions. */
export const SolutionIdSchema = z
  .string()
  .regex(SOLUTION_ID_PATTERN, 'must be a solution id of the form "solution:<slug>"')
  .meta({
    id: 'SolutionId',
    title: 'SolutionId',
    description:
      'Opaque solution-package identity: "solution:" followed by a lowercase slug (stable across versions).',
  });

/** One solution package id. */
export type SolutionId = z.infer<typeof SolutionIdSchema>;

/** Solution line identity: `line:<slug>`. */
export const SolutionLineIdSchema = z
  .string()
  .regex(SOLUTION_LINE_ID_PATTERN, 'must be a solution line id of the form "line:<slug>"')
  .meta({
    id: 'SolutionLineId',
    title: 'SolutionLineId',
    description: 'Opaque solution-line identity: "line:" followed by a lowercase slug.',
  });

/** One solution line id. */
export type SolutionLineId = z.infer<typeof SolutionLineIdSchema>;

/** Delivery record identity: `delivery:<slug>`. */
export const DeliveryIdSchema = z
  .string()
  .regex(DELIVERY_ID_PATTERN, 'must be a delivery id of the form "delivery:<slug>"')
  .meta({
    id: 'DeliveryId',
    title: 'DeliveryId',
    description: 'Opaque delivery-record identity: "delivery:" followed by a lowercase slug.',
  });

/** One delivery record id. */
export type DeliveryId = z.infer<typeof DeliveryIdSchema>;

/** Program of work identity: `program:<slug>`. */
export const ProgramIdSchema = z
  .string()
  .regex(PROGRAM_ID_PATTERN, 'must be a program id of the form "program:<slug>"')
  .meta({
    id: 'ProgramId',
    title: 'ProgramId',
    description: 'Opaque program-of-work identity: "program:" followed by a lowercase slug.',
  });

/** One program id. */
export type ProgramId = z.infer<typeof ProgramIdSchema>;

/** Work package identity: `work-package:<slug>`. */
export const WorkPackageIdSchema = z
  .string()
  .regex(WORK_PACKAGE_ID_PATTERN, 'must be a work package id of the form "work-package:<slug>"')
  .meta({
    id: 'WorkPackageId',
    title: 'WorkPackageId',
    description: 'Opaque work-package identity: "work-package:" followed by a lowercase slug.',
  });

/** One work package id. */
export type WorkPackageId = z.infer<typeof WorkPackageIdSchema>;

/** Activity identity: `activity:<slug>`. */
export const ActivityIdSchema = z
  .string()
  .regex(ACTIVITY_ID_PATTERN, 'must be an activity id of the form "activity:<slug>"')
  .meta({
    id: 'ActivityId',
    title: 'ActivityId',
    description: 'Opaque activity identity: "activity:" followed by a lowercase slug.',
  });

/** One activity id. */
export type ActivityId = z.infer<typeof ActivityIdSchema>;

/** Milestone identity: `milestone:<slug>`. */
export const MilestoneIdSchema = z
  .string()
  .regex(MILESTONE_ID_PATTERN, 'must be a milestone id of the form "milestone:<slug>"')
  .meta({
    id: 'MilestoneId',
    title: 'MilestoneId',
    description: 'Opaque milestone identity: "milestone:" followed by a lowercase slug.',
  });

/** One milestone id. */
export type MilestoneId = z.infer<typeof MilestoneIdSchema>;

/** Distinction-record identity: `<kind>:<slug>` for each of the nine kinds. */
export const DistinctionRecordIdSchema = z
  .string()
  .regex(DISTINCTION_ID_PATTERN, 'must be a distinction record id of the form "<kind>:<slug>"')
  .meta({
    id: 'DistinctionRecordId',
    title: 'DistinctionRecordId',
    description:
      'Opaque semantic-distinction record identity: one of the nine kind prefixes followed by a lowercase slug.',
  });

/** One distinction record id. */
export type DistinctionRecordId = z.infer<typeof DistinctionRecordIdSchema>;

/** Lifecycle stage-record identity: `stage:<slug>`. */
export const StageRecordIdSchema = z
  .string()
  .regex(STAGE_RECORD_ID_PATTERN, 'must be a stage record id of the form "stage:<slug>"')
  .meta({
    id: 'StageRecordId',
    title: 'StageRecordId',
    description: 'Opaque lifecycle stage-record identity: "stage:" followed by a lowercase slug.',
  });

/** One stage record id. */
export type StageRecordId = z.infer<typeof StageRecordIdSchema>;

/** Lifecycle transition-record identity: `transition:<slug>`. */
export const TransitionRecordIdSchema = z
  .string()
  .regex(TRANSITION_RECORD_ID_PATTERN, 'must be a transition record id of the form "transition:<slug>"')
  .meta({
    id: 'TransitionRecordId',
    title: 'TransitionRecordId',
    description:
      'Opaque lifecycle transition-record identity: "transition:" followed by a lowercase slug.',
  });

/** One transition record id. */
export type TransitionRecordId = z.infer<typeof TransitionRecordIdSchema>;

/** Acquisition request identity: `acquisition:<slug>`. */
export const AcquisitionIdSchema = z
  .string()
  .regex(ACQUISITION_ID_PATTERN, 'must be an acquisition id of the form "acquisition:<slug>"')
  .meta({
    id: 'AcquisitionId',
    title: 'AcquisitionId',
    description: 'Opaque acquisition-request identity: "acquisition:" followed by a lowercase slug.',
  });

/** One acquisition id. */
export type AcquisitionId = z.infer<typeof AcquisitionIdSchema>;

/** Information-acquisition request identity: `info-request:<slug>`. */
export const InfoRequestIdSchema = z
  .string()
  .regex(INFO_REQUEST_ID_PATTERN, 'must be an info request id of the form "info-request:<slug>"')
  .meta({
    id: 'InfoRequestId',
    title: 'InfoRequestId',
    description:
      'Opaque information-acquisition-request identity: "info-request:" followed by a lowercase slug.',
  });

/** One info request id. */
export type InfoRequestId = z.infer<typeof InfoRequestIdSchema>;

/** External request envelope identity: `external-request:<slug>`. */
export const ExternalRequestIdSchema = z
  .string()
  .regex(EXTERNAL_REQUEST_ID_PATTERN, 'must be an external request id of the form "external-request:<slug>"')
  .meta({
    id: 'ExternalRequestId',
    title: 'ExternalRequestId',
    description:
      'Opaque external-request envelope identity: "external-request:" followed by a lowercase slug (provider-neutral seam).',
  });

/** One external request id. */
export type ExternalRequestId = z.infer<typeof ExternalRequestIdSchema>;

/** External event envelope identity: `external-event:<slug>`. */
export const ExternalEventIdSchema = z
  .string()
  .regex(EXTERNAL_EVENT_ID_PATTERN, 'must be an external event id of the form "external-event:<slug>"')
  .meta({
    id: 'ExternalEventId',
    title: 'ExternalEventId',
    description:
      'Opaque external-event envelope identity: "external-event:" followed by a lowercase slug (provider-neutral seam).',
  });

/** One external event id. */
export type ExternalEventId = z.infer<typeof ExternalEventIdSchema>;

/** Baseline approval record identity: `approval:<slug>`. */
export const BaselineApprovalIdSchema = z
  .string()
  .regex(BASELINE_APPROVAL_ID_PATTERN, 'must be a baseline approval id of the form "approval:<slug>"')
  .meta({
    id: 'BaselineApprovalId',
    title: 'BaselineApprovalId',
    description: 'Opaque baseline-approval identity: "approval:" followed by a lowercase slug.',
  });

/** One baseline approval id. */
export type BaselineApprovalId = z.infer<typeof BaselineApprovalIdSchema>;

/** Verification gate identity: `gate:<slug>`. */
export const GateIdSchema = z
  .string()
  .regex(GATE_ID_PATTERN, 'must be a verification gate id of the form "gate:<slug>"')
  .meta({
    id: 'GateId',
    title: 'GateId',
    description: 'Opaque verification-gate identity: "gate:" followed by a lowercase slug.',
  });

/** One verification gate id. */
export type GateId = z.infer<typeof GateIdSchema>;

/** Blocker record identity: `blocker:<slug>`. */
export const BlockerIdSchema = z
  .string()
  .regex(BLOCKER_ID_PATTERN, 'must be a blocker id of the form "blocker:<slug>"')
  .meta({
    id: 'BlockerId',
    title: 'BlockerId',
    description: 'Opaque blocker-record identity: "blocker:" followed by a lowercase slug.',
  });

/** One blocker id. */
export type BlockerId = z.infer<typeof BlockerIdSchema>;

/**
 * Acting principal identity — MIRRORED from @epoch/event-log's
 * EVENT_ACTOR_PATTERN (W009 grammar; runtime parity test pins the pattern).
 */
export const PrincipalIdSchema = z
  .string()
  .regex(DELIVERY_PRINCIPAL_ID_PATTERN, 'must be a principal id of the form "principal:<slug>"')
  .meta({
    id: 'PrincipalId',
    title: 'PrincipalId',
    description: 'Opaque acting principal: "principal:" followed by a lowercase slug (W009 identity grammar).',
  });

/** One principal id. */
export type PrincipalId = z.infer<typeof PrincipalIdSchema>;

/** Delivery event stream identity — MIRRORED from W010 EVENT_STREAM_ID_PATTERN. */
export const DeliveryStreamIdSchema = z
  .string()
  .regex(DELIVERY_STREAM_ID_PATTERN, 'must be a stream id of the form "stream:<slug>"')
  .meta({
    id: 'DeliveryStreamId',
    title: 'DeliveryStreamId',
    description: 'Opaque delivery-event stream identity: "stream:" followed by a lowercase slug (the W010 stream grammar).',
  });

/** One delivery stream id. */
export type DeliveryStreamId = z.infer<typeof DeliveryStreamIdSchema>;

/** Semantic-version core string (the agent-protocol grammar). */
export const SemverCoreSchema = z
  .string()
  .regex(SEMVER_CORE_PATTERN, 'must be a semantic version core of the form MAJOR.MINOR.PATCH')
  .meta({
    id: 'SemverCore',
    title: 'SemverCore',
    description: 'Semantic version core (no prerelease/build suffixes).',
  });

/** One semver core. */
export type SemverCore = z.infer<typeof SemverCoreSchema>;

/** ISO 4217 currency code (agent-protocol grammar). */
export const CurrencyCodeSchema = z
  .string()
  .regex(ISO_CURRENCY_PATTERN, 'must be an ISO 4217 currency code (three uppercase letters)')
  .meta({
    id: 'CurrencyCode',
    title: 'CurrencyCode',
    description: 'ISO 4217 currency code (three uppercase letters).',
  });

/** One currency code. */
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/** Non-negative decimal amount as a canonical string (agent-protocol grammar). */
export const NonNegativeDecimalSchema = z
  .string()
  .regex(NON_NEGATIVE_DECIMAL_PATTERN, 'must be a non-negative decimal string (no exponent, no sign)')
  .meta({
    id: 'NonNegativeDecimal',
    title: 'NonNegativeDecimal',
    description: 'Non-negative decimal amount as a canonical string (digest-safe, no exponent form).',
  });

/** One non-negative decimal amount. */
export type NonNegativeDecimal = z.infer<typeof NonNegativeDecimalSchema>;

/** Positive integer (counts, sequence-like counters). */
export const PositiveIntegerSchema = z
  .number()
  .int('must be an integer')
  .min(1, 'must be at least 1')
  .max(Number.MAX_SAFE_INTEGER, 'must be a safe integer')
  .meta({
    id: 'PositiveInteger',
    title: 'PositiveInteger',
    description: 'Positive integer (1 to MAX_SAFE_INTEGER).',
  });

/** One positive integer. */
export type PositiveInteger = z.infer<typeof PositiveIntegerSchema>;

/** Unit of measure label (e.g. "m3", "hour", "instance", "unit"). */
export const UnitLabelSchema = z
  .string()
  .min(1)
  .max(32)
  .meta({
    id: 'UnitLabel',
    title: 'UnitLabel',
    description: 'Unit-of-measure label (1-32 characters, provider-neutral).',
  });

/** One unit label. */
export type UnitLabel = z.infer<typeof UnitLabelSchema>;

/** Opaque bounded reference string owned by its producing system. */
export const OpaqueReferenceSchema = z
  .string()
  .min(1)
  .max(256)
  .meta({
    id: 'OpaqueReference',
    title: 'OpaqueReference',
    description: 'Opaque, bounded, provider-neutral reference string owned by its producing system.',
  });

/** One opaque reference. */
export type OpaqueReference = z.infer<typeof OpaqueReferenceSchema>;

/** Qualified type name (agent-protocol grammar — pack ids, method ids). */
export const QualifiedNameSchema = z
  .string()
  .regex(QUALIFIED_NAME_PATTERN, 'must be a dot-namespaced qualified name')
  .meta({
    id: 'QualifiedName',
    title: 'QualifiedName',
    description: 'Dot-namespaced qualified name (the agent-protocol capability-id grammar).',
  });

/** One qualified name. */
export type QualifiedName = z.infer<typeof QualifiedNameSchema>;

/** Progress fraction (0 to 1 inclusive, the delivery progress convention). */
export const ProgressFractionSchema = z
  .number()
  .min(0, 'progress is a fraction (0 to 1)')
  .max(1, 'progress is a fraction (0 to 1)')
  .meta({
    id: 'ProgressFraction',
    title: 'ProgressFraction',
    description: 'Progress fraction between 0 and 1 inclusive.',
  });

/** One progress fraction. */
export type ProgressFraction = z.infer<typeof ProgressFractionSchema>;

// Re-exported for the package surface: tenancy grammar composed at runtime.
export { TenantIdSchema };
export type { TenantId } from '@epoch/tenancy';
export { TimestampSchema };
export type { Timestamp } from '@epoch/agent-protocol';
