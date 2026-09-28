/**
 * The observability schema-surface registry: every data type published
 * at the `@epoch/observability` ownership boundary, paired with its
 * zod schema.
 *
 * W030 owns no `contracts/` tree (the W024 entitlements precedent), so
 * the published contract surface lives INSIDE the package: the typed
 * index export, the runtime zod validators, and the committed JSON
 * Schema projection under `packages/observability/schemas` pinned
 * byte-for-byte by test/contract-drift.test.ts.
 *
 * Invariants enforced by the drift test: every committed schema file
 * is byte-identical to the deterministic emission of its surface
 * entry.
 */
import { type ZodType } from 'zod';
import {
  ObservationIdSchema,
  QuarantineIdSchema,
  SecurityPolicyIdSchema,
  SecurityStreamIdSchema,
  SecurityHostStreamIdSchema,
  SubjectIdSchema,
  TenantIdSchema,
  PrincipalIdSchema,
  HostFunctionTokenSchema,
  ResourceScopeTokenSchema,
  CapabilityBindingTokenSchema,
} from './primitives';
import {
  ObservationClassSchema,
  ObservationOutcomeSchema,
  ObservationSeveritySchema,
  ObservationSubjectKindSchema,
  ObservationProvenanceSchema,
  ObservationContentSchema,
  SealedObservationSchema,
} from './observation';
import {
  IsolationProfileSchema,
  PolicyStatusSchema,
  SecurityThresholdsSchema,
  SecurityPolicyContentSchema,
  SealedSecurityPolicySchema,
} from './policy';
import {
  SandboxBindingSchema,
  SandboxGrantSchema,
  SandboxSubjectSchema,
} from './subject';
import {
  QuarantineFactKindSchema,
  QuarantineFactContentSchema,
  SealedQuarantineFactSchema,
} from './quarantine';
import {
  SecurityEventSequenceSchema,
  SecurityCausalParentSchema,
  SecurityEventPayloadSchema,
  SecurityEventContentSchema,
  SealedSecurityEventSchema,
  PolicyRegisteredDataSchema,
  ObservationRecordedDataSchema,
  ViolationDetectedDataSchema,
  QuarantineImposedDataSchema,
  QuarantineReleasedDataSchema,
  HealthProjectedDataSchema,
  AuditRecordedDataSchema,
} from './events';
import {
  ProjectionSummarySchema,
  CanonicalObjectRefSchema,
} from './audit';

/** One entry of the published schema surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The FULL published schema surface of @epoch/observability. */
export const OBSERVABILITY_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ObservationId', schema: ObservationIdSchema },
  { type: 'QuarantineId', schema: QuarantineIdSchema },
  { type: 'SecurityPolicyId', schema: SecurityPolicyIdSchema },
  { type: 'SecurityStreamId', schema: SecurityStreamIdSchema },
  { type: 'SecurityHostStreamId', schema: SecurityHostStreamIdSchema },
  { type: 'SubjectId', schema: SubjectIdSchema },
  { type: 'ObservabilityTenantId', schema: TenantIdSchema },
  { type: 'ObservabilityPrincipalId', schema: PrincipalIdSchema },
  { type: 'HostFunctionToken', schema: HostFunctionTokenSchema },
  { type: 'ResourceScopeToken', schema: ResourceScopeTokenSchema },
  { type: 'CapabilityBindingToken', schema: CapabilityBindingTokenSchema },
  { type: 'ObservationSubjectKind', schema: ObservationSubjectKindSchema },
  { type: 'ObservationClass', schema: ObservationClassSchema },
  { type: 'ObservationOutcome', schema: ObservationOutcomeSchema },
  { type: 'ObservationSeverity', schema: ObservationSeveritySchema },
  { type: 'ObservationProvenance', schema: ObservationProvenanceSchema },
  { type: 'ObservationContent', schema: ObservationContentSchema },
  { type: 'SealedObservation', schema: SealedObservationSchema },
  { type: 'IsolationProfile', schema: IsolationProfileSchema },
  { type: 'PolicyStatus', schema: PolicyStatusSchema },
  { type: 'SecurityThresholds', schema: SecurityThresholdsSchema },
  { type: 'SecurityPolicyContent', schema: SecurityPolicyContentSchema },
  { type: 'SealedSecurityPolicy', schema: SealedSecurityPolicySchema },
  { type: 'SandboxBinding', schema: SandboxBindingSchema },
  { type: 'SandboxGrant', schema: SandboxGrantSchema },
  { type: 'SandboxSubject', schema: SandboxSubjectSchema },
  { type: 'QuarantineFactKind', schema: QuarantineFactKindSchema },
  { type: 'QuarantineFactContent', schema: QuarantineFactContentSchema },
  { type: 'SealedQuarantineFact', schema: SealedQuarantineFactSchema },
  { type: 'SecurityEventSequence', schema: SecurityEventSequenceSchema },
  { type: 'SecurityCausalParent', schema: SecurityCausalParentSchema },
  { type: 'SecurityEventPayload', schema: SecurityEventPayloadSchema },
  { type: 'SecurityEventContent', schema: SecurityEventContentSchema },
  { type: 'SealedSecurityEvent', schema: SealedSecurityEventSchema },
  { type: 'PolicyRegisteredData', schema: PolicyRegisteredDataSchema },
  { type: 'ObservationRecordedData', schema: ObservationRecordedDataSchema },
  { type: 'ViolationDetectedData', schema: ViolationDetectedDataSchema },
  { type: 'QuarantineImposedData', schema: QuarantineImposedDataSchema },
  { type: 'QuarantineReleasedData', schema: QuarantineReleasedDataSchema },
  { type: 'HealthProjectedData', schema: HealthProjectedDataSchema },
  { type: 'AuditRecordedData', schema: AuditRecordedDataSchema },
  { type: 'ProjectionSummary', schema: ProjectionSummarySchema },
  { type: 'CanonicalObjectRef', schema: CanonicalObjectRefSchema },
];
