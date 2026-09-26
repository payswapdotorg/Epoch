/**
 * Provider-neutral zod primitives of the execution-tracking kernel. Every
 * schema here is a JSON-representable data shape; no field encodes a
 * vendor, brand, marketplace, ERP, PM tool or field-platform surface
 * (architecture lock rule 13).
 *
 * Composition policy (the W036/W037 runtime-composition precedent):
 * shared grammars are REUSED from @epoch/solution-delivery — the digest
 * grammar, timestamps, principals, tenant scope,
 * solution/work-package/activity/milestone ids, distinction record ids,
 * delivery ids, currency codes, non-negative decimals, units, opaque
 * references and progress fractions (genuine runtime composition over
 * the W036 kernel, never a mirror). The execution-specific id grammars
 * (state, resource-observation, evidence-link, the five issue families,
 * issue-resolution, reconciliation, field-capture keys) are defined
 * here. Digest machinery (canonicalDigest, sha256Hex) comes from
 * @epoch/agent-protocol (the shared protocol primitives, as in W036).
 */
import { z } from 'zod';
import { canonicalDigest, sha256Hex } from '@epoch/agent-protocol';
import {
  CurrencyCodeSchema,
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  MilestoneIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  ProgressFractionSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
} from '@epoch/solution-delivery';
import {
  BLOCKER_ID_PATTERN,
  CHANGE_ID_PATTERN,
  DEFECT_ID_PATTERN,
  DELAY_ID_PATTERN,
  EVIDENCE_LINK_ID_PATTERN,
  EXECUTION_PRINCIPAL_ID_PATTERN,
  EXECUTION_STREAM_ID_PATTERN,
  FIELD_CAPTURE_KEY_PATTERN,
  ISSUE_RESOLUTION_ID_PATTERN,
  RECONCILIATION_ID_PATTERN,
  RESOURCE_OBSERVATION_ID_PATTERN,
  REWORK_ID_PATTERN,
  STATE_ID_PATTERN,
} from './version';

// Digest machinery (composed from the shared protocol primitives).
export { canonicalDigest, sha256Hex };

/**
 * Activity identity — MIRRORED from the W036 `ACTIVITY_ID_PATTERN`
 * grammar (`activity:<slug>`); pinned by the runtime parity test (REAL
 * W036 activity ids validate through this grammar and vice versa).
 */
export const ActivityIdSchema = z
  .string()
  .regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/, 'must be an activity id of the form "activity:<slug>"')
  .meta({
    id: 'ActivityId',
    title: 'ActivityId',
    description:
      'Opaque activity identity: "activity:" followed by a lowercase slug (the W036 ProgramOfWork grammar).',
  });

/** One activity id. */
export type ActivityId = z.infer<typeof ActivityIdSchema>;

/** Tracking-state record identity: `state:<slug>`. */
export const StateIdSchema = z
  .string()
  .regex(STATE_ID_PATTERN, 'must be a tracking-state id of the form "state:<slug>"')
  .meta({
    id: 'StateId',
    title: 'StateId',
    description: 'Opaque tracking-state record identity: "state:" followed by a lowercase slug.',
  });

/** One tracking-state record id. */
export type StateId = z.infer<typeof StateIdSchema>;

/** Resource-observation record identity: `resource-observation:<slug>`. */
export const ResourceObservationIdSchema = z
  .string()
  .regex(
    RESOURCE_OBSERVATION_ID_PATTERN,
    'must be a resource-observation id of the form "resource-observation:<slug>"',
  )
  .meta({
    id: 'ResourceObservationId',
    title: 'ResourceObservationId',
    description:
      'Opaque resource-usage observation record identity: "resource-observation:" followed by a lowercase slug.',
  });

/** One resource-observation record id. */
export type ResourceObservationId = z.infer<typeof ResourceObservationIdSchema>;

/** Field-evidence-link record identity: `evidence-link:<slug>`. */
export const EvidenceLinkIdSchema = z
  .string()
  .regex(EVIDENCE_LINK_ID_PATTERN, 'must be an evidence-link id of the form "evidence-link:<slug>"')
  .meta({
    id: 'EvidenceLinkId',
    title: 'EvidenceLinkId',
    description:
      'Opaque field-evidence-link record identity: "evidence-link:" followed by a lowercase slug.',
  });

/** One evidence-link record id. */
export type EvidenceLinkId = z.infer<typeof EvidenceLinkIdSchema>;

/** Change-record identity: `change:<slug>`. */
export const ChangeIdSchema = z
  .string()
  .regex(CHANGE_ID_PATTERN, 'must be a change id of the form "change:<slug>"')
  .meta({
    id: 'ChangeId',
    title: 'ChangeId',
    description: 'Opaque change-record identity: "change:" followed by a lowercase slug.',
  });

/** One change record id. */
export type ChangeId = z.infer<typeof ChangeIdSchema>;

/** Delay-record identity: `delay:<slug>`. */
export const DelayIdSchema = z
  .string()
  .regex(DELAY_ID_PATTERN, 'must be a delay id of the form "delay:<slug>"')
  .meta({
    id: 'DelayId',
    title: 'DelayId',
    description: 'Opaque delay-record identity: "delay:" followed by a lowercase slug.',
  });

/** One delay record id. */
export type DelayId = z.infer<typeof DelayIdSchema>;

/** Rework-record identity: `rework:<slug>`. */
export const ReworkIdSchema = z
  .string()
  .regex(REWORK_ID_PATTERN, 'must be a rework id of the form "rework:<slug>"')
  .meta({
    id: 'ReworkId',
    title: 'ReworkId',
    description: 'Opaque rework-record identity: "rework:" followed by a lowercase slug.',
  });

/** One rework record id. */
export type ReworkId = z.infer<typeof ReworkIdSchema>;

/** Defect-record identity: `defect:<slug>`. */
export const DefectIdSchema = z
  .string()
  .regex(DEFECT_ID_PATTERN, 'must be a defect id of the form "defect:<slug>"')
  .meta({
    id: 'DefectId',
    title: 'DefectId',
    description: 'Opaque defect-record identity: "defect:" followed by a lowercase slug.',
  });

/** One defect record id. */
export type DefectId = z.infer<typeof DefectIdSchema>;

/** Blocker-record identity: `blocker:<slug>` (the W036 grammar). */
export const BlockerIdSchema = z
  .string()
  .regex(BLOCKER_ID_PATTERN, 'must be a blocker id of the form "blocker:<slug>"')
  .meta({
    id: 'BlockerId',
    title: 'BlockerId',
    description: 'Opaque blocker-record identity: "blocker:" followed by a lowercase slug.',
  });

/** One blocker record id. */
export type BlockerId = z.infer<typeof BlockerIdSchema>;

/** One issue-family record id (any of the five prefixes). */
export const IssueRecordIdSchema = z
  .string()
  .regex(
    /^(change|delay|rework|defect|blocker):[a-z0-9][a-z0-9-]{0,62}$/,
    'must be an issue id of the form "(change|delay|rework|defect|blocker):<slug>"',
  )
  .meta({
    id: 'IssueRecordId',
    title: 'IssueRecordId',
    description:
      'Opaque execution-issue record identity: one of the five family prefixes followed by a lowercase slug.',
  });

/** One issue-family record id. */
export type IssueRecordId = z.infer<typeof IssueRecordIdSchema>;

/** Issue-resolution record identity: `issue-resolution:<slug>`. */
export const IssueResolutionIdSchema = z
  .string()
  .regex(
    ISSUE_RESOLUTION_ID_PATTERN,
    'must be an issue-resolution id of the form "issue-resolution:<slug>"',
  )
  .meta({
    id: 'IssueResolutionId',
    title: 'IssueResolutionId',
    description:
      'Opaque issue-resolution record identity: "issue-resolution:" followed by a lowercase slug.',
  });

/** One issue-resolution record id. */
export type IssueResolutionId = z.infer<typeof IssueResolutionIdSchema>;

/** Reconciliation-proposal record identity: `reconciliation:<slug>`. */
export const ReconciliationIdSchema = z
  .string()
  .regex(
    RECONCILIATION_ID_PATTERN,
    'must be a reconciliation id of the form "reconciliation:<slug>"',
  )
  .meta({
    id: 'ReconciliationId',
    title: 'ReconciliationId',
    description:
      'Opaque reconciliation-proposal record identity: "reconciliation:" followed by a lowercase slug.',
  });

/** One reconciliation-proposal record id. */
export type ReconciliationId = z.infer<typeof ReconciliationIdSchema>;

/** The low-friction field-capture key (a bare slug embedded in derived ids). */
export const FieldCaptureKeySchema = z
  .string()
  .regex(FIELD_CAPTURE_KEY_PATTERN, 'must be a lowercase slug field-capture key')
  .meta({
    id: 'FieldCaptureKey',
    title: 'FieldCaptureKey',
    description:
      'The low-friction field-capture key: a lowercase slug (max 48) embedded in the derived record ids and the idempotency keys.',
  });

/** One field-capture key. */
export type FieldCaptureKey = z.infer<typeof FieldCaptureKeySchema>;

/** Execution event stream identity (the W010 stream grammar, mirrored). */
export const ExecutionStreamIdSchema = z
  .string()
  .regex(EXECUTION_STREAM_ID_PATTERN, 'must be a stream id of the form "stream:<slug>"')
  .meta({
    id: 'ExecutionStreamId',
    title: 'ExecutionStreamId',
    description:
      'Opaque execution-event stream identity: "stream:" followed by a lowercase slug (the W010 stream grammar).',
  });

/** One execution stream id. */
export type ExecutionStreamId = z.infer<typeof ExecutionStreamIdSchema>;

/** Acting principal identity (the W009/W010 grammar, mirrored). */
export const ExecutionPrincipalIdSchema = z
  .string()
  .regex(
    EXECUTION_PRINCIPAL_ID_PATTERN,
    'must be a principal id of the form "principal:<slug>"',
  )
  .meta({
    id: 'ExecutionPrincipalId',
    title: 'ExecutionPrincipalId',
    description:
      'Opaque acting principal: "principal:" followed by a lowercase slug (W009 identity grammar).',
  });

/** One execution principal id. */
export type ExecutionPrincipalId = z.infer<typeof ExecutionPrincipalIdSchema>;

// Shared W036 grammars re-exported for the package surface (runtime
// composition — the W036 kernel's own public surface).
export {
  CurrencyCodeSchema,
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  MilestoneIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  ProgressFractionSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
};
export type {
  CurrencyCode,
  DeliveryId,
  DistinctionRecordId,
  MilestoneId,
  NonNegativeDecimal,
  OpaqueReference,
  PrincipalId,
  ProgressFraction,
  SemverCore,
  SolutionId,
  Timestamp,
  UnitLabel,
  WorkPackageId,
} from '@epoch/solution-delivery';
export type { Sha256Hex } from '@epoch/agent-protocol';
export { TenantIdSchema } from '@epoch/solution-delivery';
export type { TenantId } from '@epoch/solution-delivery';
