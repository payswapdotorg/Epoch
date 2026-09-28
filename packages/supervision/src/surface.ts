/**
 * The supervision schema-surface registry: every data type published at
 * the `@epoch/supervision` ownership boundary, paired with its zod
 * schema.
 *
 * W043 publishes TWO versioned contract artifact sets from this one
 * surface:
 *
 * - the IN-PACKAGE full surface under
 *   `packages/supervision/schemas` (the W006/W007/W009/W023/W036/W038
 *   in-package precedent) — every entry below;
 * - the PUBLIC core-record projection under `contracts/supervision`
 *   (the W012 convention) — the SUPERVISION_CORE_RECORD_SURFACE subset,
 *   composed with the alerts-kernel core records by the
 *   supervision-runtime service (the only W043 component that depends
 *   on both kernels; see services/supervision/src/contract-emission.ts).
 *
 * Invariants enforced by the drift test: every committed schema file is
 * byte-identical to the deterministic emission of its surface entry.
 */
import { type ZodType } from 'zod';
import {
  FindingIdSchema,
  SupervisionPassIdSchema,
  SupervisionStreamIdSchema,
  SupervisionPrincipalIdSchema,
  IssueSummaryIdSchema,
  LeadTimeInputIdSchema,
  FindingClassTokenSchema,
  SubjectKindTokenSchema,
} from './primitives';
import {
  ProvenanceSourceSchema,
  FindingProvenanceSchema,
} from './provenance';
import {
  FindingMeasuresSchema,
  FindingSubjectSchema,
  SupervisionFindingContentSchema,
  SealedSupervisionFindingSchema,
} from './findings';
import {
  ExecutionIssueSummarySchema,
  IssueSummaryImpactSchema,
  LeadTimeSourceRecordSchema,
  LeadTimeRiskInputSchema,
  SupervisionThresholdsSchema,
} from './inputs';
import {
  SupervisionPassContentSchema,
  SealedSupervisionPassSchema,
} from './supervision';
import {
  SupervisionEventSequenceSchema,
  SupervisionCausalParentSchema,
  SupervisionEventPayloadSchema,
  SupervisionEventContentSchema,
  SealedSupervisionEventSchema,
} from './events';

/** One entry of the published schema surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The FULL published schema surface of @epoch/supervision. */
export const SUPERVISION_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'FindingId', schema: FindingIdSchema },
  { type: 'SupervisionPassId', schema: SupervisionPassIdSchema },
  { type: 'SupervisionStreamId', schema: SupervisionStreamIdSchema },
  { type: 'SupervisionPrincipalId', schema: SupervisionPrincipalIdSchema },
  { type: 'IssueSummaryId', schema: IssueSummaryIdSchema },
  { type: 'LeadTimeInputId', schema: LeadTimeInputIdSchema },
  { type: 'FindingClassToken', schema: FindingClassTokenSchema },
  { type: 'SubjectKindToken', schema: SubjectKindTokenSchema },
  { type: 'ProvenanceSource', schema: ProvenanceSourceSchema },
  { type: 'FindingProvenance', schema: FindingProvenanceSchema },
  { type: 'FindingMeasures', schema: FindingMeasuresSchema },
  { type: 'FindingSubject', schema: FindingSubjectSchema },
  { type: 'SupervisionFindingContent', schema: SupervisionFindingContentSchema },
  { type: 'SealedSupervisionFinding', schema: SealedSupervisionFindingSchema },
  { type: 'IssueSummaryImpact', schema: IssueSummaryImpactSchema },
  { type: 'ExecutionIssueSummary', schema: ExecutionIssueSummarySchema },
  { type: 'LeadTimeSourceRecord', schema: LeadTimeSourceRecordSchema },
  { type: 'LeadTimeRiskInput', schema: LeadTimeRiskInputSchema },
  { type: 'SupervisionThresholds', schema: SupervisionThresholdsSchema },
  { type: 'SupervisionPassContent', schema: SupervisionPassContentSchema },
  { type: 'SealedSupervisionPass', schema: SealedSupervisionPassSchema },
  { type: 'SupervisionEventSequence', schema: SupervisionEventSequenceSchema },
  { type: 'SupervisionCausalParent', schema: SupervisionCausalParentSchema },
  { type: 'SupervisionEventPayload', schema: SupervisionEventPayloadSchema },
  { type: 'SupervisionEventContent', schema: SupervisionEventContentSchema },
  { type: 'SealedSupervisionEvent', schema: SealedSupervisionEventSchema },
] as const;

/**
 * The CORE record subset of the public contract projection
 * (`contracts/supervision`, the W012 convention): the sealed record
 * types a domain pack or downstream consumer binds to.
 */
export const SUPERVISION_CORE_RECORD_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'FindingMeasures', schema: FindingMeasuresSchema },
  { type: 'FindingSubject', schema: FindingSubjectSchema },
  { type: 'SupervisionFindingContent', schema: SupervisionFindingContentSchema },
  { type: 'SealedSupervisionFinding', schema: SealedSupervisionFindingSchema },
  { type: 'ExecutionIssueSummary', schema: ExecutionIssueSummarySchema },
  { type: 'LeadTimeRiskInput', schema: LeadTimeRiskInputSchema },
  { type: 'SupervisionThresholds', schema: SupervisionThresholdsSchema },
  { type: 'SupervisionPassContent', schema: SupervisionPassContentSchema },
  { type: 'SealedSupervisionPass', schema: SealedSupervisionPassSchema },
  { type: 'SealedSupervisionEvent', schema: SealedSupervisionEventSchema },
] as const;
