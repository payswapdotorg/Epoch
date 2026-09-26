/**
 * The execution-tracking schema-surface registry: every data type published
 * at the `@epoch/execution-tracking` ownership boundary, paired with its
 * zod schema.
 *
 * W038 publishes TWO versioned contract artifact sets from this one
 * surface (both drift-pinned by test/contract-drift.test.ts):
 *
 * - the IN-PACKAGE full surface under
 *   `packages/execution-tracking/schemas` (the W006/W007/W009/W023/W036
 *   in-package precedent) — every entry below;
 * - the PUBLIC core-record projection under `contracts/execution/schemas`
 *   (the W012 convention) — the CORE_RECORD_SURFACE subset (see
 *   src/contract-emission.ts).
 *
 * Invariants enforced by the drift test: every committed schema file is
 * byte-identical to the deterministic emission of its surface entry.
 */
import { z, type ZodType } from 'zod';
import {
  ExecutionStreamIdSchema,
  EvidenceLinkIdSchema,
  IssueRecordIdSchema,
  IssueResolutionIdSchema,
  PrincipalIdSchema,
  ReconciliationIdSchema,
  ResourceObservationIdSchema,
  SolutionIdSchema,
  StateIdSchema,
  TimestampSchema,
  WorkPackageIdSchema,
  ActivityIdSchema,
  MilestoneIdSchema,
  DistinctionRecordIdSchema,
  DeliveryIdSchema,
  FieldCaptureKeySchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  UnitLabelSchema,
  Sha256HexSchema,
} from './primitives';
import {
  FieldEvidenceLinkSchema,
  FieldEvidenceLinkRecordContentSchema,
  SealedFieldEvidenceLinkSchema,
} from './field-evidence';
import {
  TrackingSubjectSchema,
  TrackingStateRecordContentSchema,
  SealedTrackingStateRecordSchema,
} from './state';
import {
  ResourceKindSchema,
  ResourceObservationContentSchema,
  SealedResourceObservationSchema,
} from './resource';
import {
  IssueImpactSchema,
  ReworkReferenceSchema,
  BlockerSemanticsSchema,
  IssueRecordContentSchema,
  SealedIssueRecordSchema,
  IssueResolutionContentSchema,
  SealedIssueResolutionSchema,
} from './execution-issues';
import {
  ReconciliationEntrySchema,
  ReconciliationProposalContentSchema,
  SealedReconciliationProposalSchema,
} from './reconciliation';
import {
  ExecutionEventSequenceSchema,
  ExecutionCausalParentSchema,
  ExecutionEventPayloadSchema,
  ExecutionEventContentSchema,
  SealedExecutionEventSchema,
} from './events';
import {
  CaptureSubjectSchema,
  CaptureResourceUsageSchema,
  FieldCaptureSchema,
} from './store';
import {
  DOMAIN_TRACKING_STATE_BINDINGS,
  FIELD_EVIDENCE_KINDS,
  ISSUE_KINDS,
  ISSUE_RESOLUTIONS,
  ISSUE_SEVERITIES,
  RESOLUTION_STATES,
  TRACKING_STATES,
} from './version';

/** One published schema-surface entry: the type name + its zod schema. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete in-package schema surface (the W023 in-package convention). */
export const EXECUTION_TRACKING_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  // Primitives.
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'SolutionId', schema: SolutionIdSchema },
  { type: 'WorkPackageId', schema: WorkPackageIdSchema },
  { type: 'ActivityId', schema: ActivityIdSchema },
  { type: 'MilestoneId', schema: MilestoneIdSchema },
  { type: 'DeliveryId', schema: DeliveryIdSchema },
  { type: 'DistinctionRecordId', schema: DistinctionRecordIdSchema },
  { type: 'StateId', schema: StateIdSchema },
  { type: 'ResourceObservationId', schema: ResourceObservationIdSchema },
  { type: 'EvidenceLinkId', schema: EvidenceLinkIdSchema },
  { type: 'IssueRecordId', schema: IssueRecordIdSchema },
  { type: 'IssueResolutionId', schema: IssueResolutionIdSchema },
  { type: 'ReconciliationId', schema: ReconciliationIdSchema },
  { type: 'FieldCaptureKey', schema: FieldCaptureKeySchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'ExecutionStreamId', schema: ExecutionStreamIdSchema },
  { type: 'NonNegativeDecimal', schema: NonNegativeDecimalSchema },
  { type: 'OpaqueReference', schema: OpaqueReferenceSchema },
  { type: 'UnitLabel', schema: UnitLabelSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  // Vocabularies.
  { type: 'TrackingState', schema: z.enum(TRACKING_STATES) },
  { type: 'ResourceKind', schema: ResourceKindSchema },
  { type: 'FieldEvidenceKind', schema: z.enum(FIELD_EVIDENCE_KINDS) },
  { type: 'IssueKind', schema: z.enum(ISSUE_KINDS) },
  { type: 'IssueSeverity', schema: z.enum(ISSUE_SEVERITIES) },
  { type: 'ResolutionState', schema: z.enum(RESOLUTION_STATES) },
  { type: 'IssueResolutionDecision', schema: z.enum(ISSUE_RESOLUTIONS) },
  {
    type: 'DomainTrackingStateBindings',
    schema: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
  },
  // Field evidence references.
  { type: 'FieldEvidenceLink', schema: FieldEvidenceLinkSchema },
  { type: 'FieldEvidenceLinkRecordContent', schema: FieldEvidenceLinkRecordContentSchema },
  { type: 'SealedFieldEvidenceLink', schema: SealedFieldEvidenceLinkSchema },
  // Tracking states.
  { type: 'TrackingSubject', schema: TrackingSubjectSchema },
  { type: 'TrackingStateRecordContent', schema: TrackingStateRecordContentSchema },
  { type: 'SealedTrackingStateRecord', schema: SealedTrackingStateRecordSchema },
  // Resource observations.
  { type: 'ResourceObservationContent', schema: ResourceObservationContentSchema },
  { type: 'SealedResourceObservation', schema: SealedResourceObservationSchema },
  // Execution issues.
  { type: 'IssueImpact', schema: IssueImpactSchema },
  { type: 'ReworkReference', schema: ReworkReferenceSchema },
  { type: 'BlockerSemantics', schema: BlockerSemanticsSchema },
  { type: 'IssueRecordContent', schema: IssueRecordContentSchema },
  { type: 'SealedIssueRecord', schema: SealedIssueRecordSchema },
  { type: 'IssueResolutionContent', schema: IssueResolutionContentSchema },
  { type: 'SealedIssueResolution', schema: SealedIssueResolutionSchema },
  // Reconciliation.
  { type: 'ReconciliationEntry', schema: ReconciliationEntrySchema },
  { type: 'ReconciliationProposalContent', schema: ReconciliationProposalContentSchema },
  { type: 'SealedReconciliationProposal', schema: SealedReconciliationProposalSchema },
  // The low-friction field capture.
  { type: 'CaptureSubject', schema: CaptureSubjectSchema },
  { type: 'CaptureResourceUsage', schema: CaptureResourceUsageSchema },
  { type: 'FieldCapture', schema: FieldCaptureSchema },
  // Events (the W010-shaped vocabulary).
  { type: 'ExecutionEventSequence', schema: ExecutionEventSequenceSchema },
  { type: 'ExecutionCausalParent', schema: ExecutionCausalParentSchema },
  { type: 'ExecutionEventPayload', schema: ExecutionEventPayloadSchema },
  { type: 'ExecutionEventContent', schema: ExecutionEventContentSchema },
  { type: 'SealedExecutionEvent', schema: SealedExecutionEventSchema },
];

/**
 * The CORE record surface — the subset published at
 * `contracts/execution/schemas` (the W012 public-contract convention):
 * the core record types a domain pack or downstream consumer binds to.
 */
export const CORE_RECORD_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'FieldEvidenceLink', schema: FieldEvidenceLinkSchema },
  { type: 'FieldEvidenceLinkRecordContent', schema: FieldEvidenceLinkRecordContentSchema },
  { type: 'SealedFieldEvidenceLink', schema: SealedFieldEvidenceLinkSchema },
  { type: 'TrackingSubject', schema: TrackingSubjectSchema },
  { type: 'TrackingStateRecordContent', schema: TrackingStateRecordContentSchema },
  { type: 'SealedTrackingStateRecord', schema: SealedTrackingStateRecordSchema },
  { type: 'ResourceObservationContent', schema: ResourceObservationContentSchema },
  { type: 'SealedResourceObservation', schema: SealedResourceObservationSchema },
  { type: 'IssueImpact', schema: IssueImpactSchema },
  { type: 'ReworkReference', schema: ReworkReferenceSchema },
  { type: 'BlockerSemantics', schema: BlockerSemanticsSchema },
  { type: 'IssueRecordContent', schema: IssueRecordContentSchema },
  { type: 'SealedIssueRecord', schema: SealedIssueRecordSchema },
  { type: 'IssueResolutionContent', schema: IssueResolutionContentSchema },
  { type: 'SealedIssueResolution', schema: SealedIssueResolutionSchema },
  { type: 'ReconciliationProposalContent', schema: ReconciliationProposalContentSchema },
  { type: 'SealedReconciliationProposal', schema: SealedReconciliationProposalSchema },
  { type: 'FieldCapture', schema: FieldCaptureSchema },
  { type: 'ExecutionEventContent', schema: ExecutionEventContentSchema },
  { type: 'SealedExecutionEvent', schema: SealedExecutionEventSchema },
];

/** The domain vocabulary projection constant (re-exported for tests). */
export { DOMAIN_TRACKING_STATE_BINDINGS };
