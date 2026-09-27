/**
 * The access-projection schema-surface registry: every data type
 * published at the `@epoch/access-projection` ownership boundary,
 * paired with its zod schema.
 *
 * W041 publishes TWO versioned contract artifact sets from this one
 * surface (both drift-pinned by test/contract-drift.test.ts):
 *
 * - the IN-PACKAGE full surface under
 *   `packages/access-projection/schemas` (the W006/W007/W009/W023/W036
 *   in-package precedent) — every entry below;
 * - the PUBLIC core-record projection under
 *   `contracts/access-projection/schemas` (the W012 convention) — the
 *   CORE_RECORD_SURFACE subset (see src/contract-emission.ts).
 *
 * Invariants enforced by the drift test: every committed schema file is
 * byte-identical to the deterministic emission of its surface entry.
 */
import type { ZodType } from 'zod';
import {
  AccessPrincipalIdSchema,
  AccessStreamIdSchema,
  AgentTaskClassSchema,
  AuditRecordIdSchema,
  FieldPathTemplateSchema,
  PolicyIdSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  RoleIdSchema,
  TenantIdSchema,
  TimestampSchema,
  Sha256HexSchema,
} from './primitives';
import {
  AppliedScopesSchema,
  AuditProvenanceSchema,
  ProjectionAuditContentSchema,
  SealedProjectionAuditSchema,
} from './audit';
import {
  BindingSelectorSchema,
  EvidenceScopeSchema,
  PolicyBindingSchema,
  PolicyRevisionRefSchema,
  ProjectionPolicyContentSchema,
  ProjectionSubjectSchema,
  RedactionRuleSchema,
  ScopeFiltersSchema,
  SectionVisibilitySchema,
  SealedProjectionPolicySchema,
} from './policy';
import {
  AuthorizedProjectionContentSchema,
  PolicyClauseRefSchema,
  ProjectionEntrySchema,
  RedactionMarkerSchema,
  ReleasedFieldSchema,
  SealedAuthorizedProjectionSchema,
} from './projection';
import {
  AccessProjectionCausalParentSchema,
  AccessProjectionEventContentSchema,
  AccessProjectionEventPayloadSchema,
  AccessProjectionEventSequenceSchema,
  AuditRecordedDataSchema,
  PolicyRegisteredDataSchema,
  ProjectionDeniedDataSchema,
  ProjectionReleasedDataSchema,
  RecordAdmittedDataSchema,
  SealedAccessProjectionEventSchema,
  StateProjectedDataSchema,
} from './events';
import { TaskProjectionContextSchema } from './task';
import { CanonicalRecordSchema } from './records';

/** One schema-surface entry: a published data type + its zod schema. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete access-projection schema surface (ordered). */
export const ACCESS_PROJECTION_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'PolicyId', schema: PolicyIdSchema },
  { type: 'RoleId', schema: RoleIdSchema },
  { type: 'AgentTaskClass', schema: AgentTaskClassSchema },
  { type: 'AuditRecordId', schema: AuditRecordIdSchema },
  { type: 'AccessStreamId', schema: AccessStreamIdSchema },
  { type: 'AccessPrincipalId', schema: AccessPrincipalIdSchema },
  { type: 'FieldPathTemplate', schema: FieldPathTemplateSchema },
  { type: 'PositiveInteger', schema: PositiveIntegerSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'TenantId', schema: TenantIdSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'EvidenceScope', schema: EvidenceScopeSchema },
  { type: 'SectionVisibility', schema: SectionVisibilitySchema },
  { type: 'ScopeFilters', schema: ScopeFiltersSchema },
  { type: 'RedactionRule', schema: RedactionRuleSchema },
  { type: 'BindingSelector', schema: BindingSelectorSchema },
  { type: 'PolicyBinding', schema: PolicyBindingSchema },
  { type: 'ProjectionSubject', schema: ProjectionSubjectSchema },
  { type: 'PolicyRevisionRef', schema: PolicyRevisionRefSchema },
  { type: 'ProjectionPolicyContent', schema: ProjectionPolicyContentSchema },
  { type: 'SealedProjectionPolicy', schema: SealedProjectionPolicySchema },
  { type: 'TaskProjectionContext', schema: TaskProjectionContextSchema },
  { type: 'CanonicalRecord', schema: CanonicalRecordSchema },
  { type: 'PolicyClauseRef', schema: PolicyClauseRefSchema },
  { type: 'RedactionMarker', schema: RedactionMarkerSchema },
  { type: 'ReleasedField', schema: ReleasedFieldSchema },
  { type: 'ProjectionEntry', schema: ProjectionEntrySchema },
  { type: 'AuthorizedProjectionContent', schema: AuthorizedProjectionContentSchema },
  { type: 'SealedAuthorizedProjection', schema: SealedAuthorizedProjectionSchema },
  { type: 'AuditProvenance', schema: AuditProvenanceSchema },
  { type: 'AppliedScopes', schema: AppliedScopesSchema },
  { type: 'ProjectionAuditContent', schema: ProjectionAuditContentSchema },
  { type: 'SealedProjectionAudit', schema: SealedProjectionAuditSchema },
  { type: 'AccessProjectionEventSequence', schema: AccessProjectionEventSequenceSchema },
  { type: 'AccessProjectionCausalParent', schema: AccessProjectionCausalParentSchema },
  { type: 'AccessProjectionEventPayload', schema: AccessProjectionEventPayloadSchema },
  { type: 'AccessProjectionEventContent', schema: AccessProjectionEventContentSchema },
  { type: 'SealedAccessProjectionEvent', schema: SealedAccessProjectionEventSchema },
  { type: 'PolicyRegisteredData', schema: PolicyRegisteredDataSchema },
  { type: 'RecordAdmittedData', schema: RecordAdmittedDataSchema },
  { type: 'ProjectionReleasedData', schema: ProjectionReleasedDataSchema },
  { type: 'ProjectionDeniedData', schema: ProjectionDeniedDataSchema },
  { type: 'AuditRecordedData', schema: AuditRecordedDataSchema },
  { type: 'StateProjectedData', schema: StateProjectedDataSchema },
];

/** The public core-record surface (the W012 `contracts/access-projection` set). */
export const CORE_RECORD_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'PolicyId', schema: PolicyIdSchema },
  { type: 'RoleId', schema: RoleIdSchema },
  { type: 'AgentTaskClass', schema: AgentTaskClassSchema },
  { type: 'AuditRecordId', schema: AuditRecordIdSchema },
  { type: 'AccessStreamId', schema: AccessStreamIdSchema },
  { type: 'AccessPrincipalId', schema: AccessPrincipalIdSchema },
  { type: 'FieldPathTemplate', schema: FieldPathTemplateSchema },
  { type: 'PositiveInteger', schema: PositiveIntegerSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'TenantId', schema: TenantIdSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'EvidenceScope', schema: EvidenceScopeSchema },
  { type: 'SectionVisibility', schema: SectionVisibilitySchema },
  { type: 'ScopeFilters', schema: ScopeFiltersSchema },
  { type: 'RedactionRule', schema: RedactionRuleSchema },
  { type: 'BindingSelector', schema: BindingSelectorSchema },
  { type: 'PolicyBinding', schema: PolicyBindingSchema },
  { type: 'ProjectionSubject', schema: ProjectionSubjectSchema },
  { type: 'PolicyRevisionRef', schema: PolicyRevisionRefSchema },
  { type: 'ProjectionPolicyContent', schema: ProjectionPolicyContentSchema },
  { type: 'SealedProjectionPolicy', schema: SealedProjectionPolicySchema },
  { type: 'TaskProjectionContext', schema: TaskProjectionContextSchema },
  { type: 'PolicyClauseRef', schema: PolicyClauseRefSchema },
  { type: 'RedactionMarker', schema: RedactionMarkerSchema },
  { type: 'ReleasedField', schema: ReleasedFieldSchema },
  { type: 'ProjectionEntry', schema: ProjectionEntrySchema },
  { type: 'AuthorizedProjectionContent', schema: AuthorizedProjectionContentSchema },
  { type: 'SealedAuthorizedProjection', schema: SealedAuthorizedProjectionSchema },
  { type: 'AuditProvenance', schema: AuditProvenanceSchema },
  { type: 'AppliedScopes', schema: AppliedScopesSchema },
  { type: 'ProjectionAuditContent', schema: ProjectionAuditContentSchema },
  { type: 'SealedProjectionAudit', schema: SealedProjectionAuditSchema },
  { type: 'AccessProjectionEventContent', schema: AccessProjectionEventContentSchema },
  { type: 'SealedAccessProjectionEvent', schema: SealedAccessProjectionEventSchema },
];
