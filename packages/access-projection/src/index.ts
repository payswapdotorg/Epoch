/**
 * @epoch/access-projection — public API (kernel layer, Work Order W041).
 *
 * The FINE-GRAINED ACCESS + AUTHORIZED PROJECTIONS kernel (binding):
 *
 * - Projection POLICY IS DATA: typed, versioned, sealed
 *   ProjectionPolicy records bind (principal role OR agent-task class)
 *   x object class -> allowed actions -> minimum-necessary field
 *   allowlists -> evidence/commercial/supplier scope filters ->
 *   redaction rules. Swapping a policy revision changes the projection
 *   with ZERO code change.
 * - TWO-STAGE evaluation, strictly ordered: the W009 authorization
 *   decision point answers allow/deny FIRST (the kernel CONSUMES sealed
 *   decisions and their request digests — `authorization-bypass-rejected`
 *   without one); the projection stage then computes the visible subset.
 * - MINIMUM-NECESSARY selection through a zod-schema-driven field walk
 *   over the W036 record shapes: released fields pass through BY
 *   REFERENCE (same value, same digest); everything else becomes a typed
 *   RedactionMarker (never a silent drop).
 * - STABLE SEMANTIC IDENTITY: a projection carries the SAME record id
 *   and content digest as the canonical record — projections never mint
 *   identities (`identity-fork-rejected`).
 * - AGENT TASK-SPECIFIC projections: a TaskProjectionContext narrows to
 *   the task's object scope, never wider than the role baseline
 *   (`task-escalation-rejected`).
 * - EXPORT/SHARE are distinct actions with their own policy rows
 *   (`export-without-grant-rejected`, `share-without-grant-rejected`);
 *   service principals follow the same two-stage path as humans.
 * - AUDITABILITY: every projection decision emits a sealed,
 *   content-addressed ProjectionAuditRecord (evaluation-key replay
 *   discipline: identical inputs -> identical digests).
 * - The access-projection:* event vocabulary over the W010 event shapes.
 *
 * Identity != tenancy != authorization != policy (lock rule 12): the
 * decision point is @epoch/authorization's (W009), the canonical
 * records are @epoch/solution-delivery's (W036), tenancy is
 * @epoch/tenancy's. This kernel CONSUMES them; it never re-implements
 * them, and it never creates a second authority.
 *
 * In-memory reference behavior: NO persistence, NO network, NO UI, NO
 * provider vocabulary. Deterministic: zero wall-clock, zero randomness
 * — instants are caller-supplied inputs.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), compile-time kernel
 * parity (src/kernel-parity.ts), the committed in-package JSON Schema
 * projection under schemas/ (the W007/W009/W023 convention), the public
 * core-record surface at contracts/access-projection/ (the W012
 * convention), both pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  ACCESS_ACTION_KINDS,
  ACCESS_ACTION_KIND_PREFIX,
  ACCESS_PROJECTION_CONTRACT_VERSION,
  ACCESS_PROJECTION_EVENT_DISCRIMINATORS,
  ACCESS_PROJECTION_EVENT_RECORD_VERSION,
  ACCESS_PROJECTION_RECORD_VERSION,
  ACCESS_PRINCIPAL_ID_PATTERN,
  ACCESS_STREAM_ID_PATTERN,
  AGENT_TASK_CLASS_PATTERN,
  AUDIT_RECORD_ID_PATTERN,
  AUTHORIZED_PROJECTION_SCHEMA_NAME,
  EVALUATION_KEY_SCOPE,
  EVIDENCE_SCOPE_MODES,
  OBJECT_CLASSES,
  OBJECT_CLASS_SCHEMA_NAMES,
  POLICY_ID_PATTERN,
  POLICY_STATUSES,
  PROJECTION_ACTIONS,
  PROJECTION_AUDIT_SCHEMA_NAME,
  PROJECTION_POLICY_SCHEMA_NAME,
  PROJECTION_PRINCIPAL_KINDS,
  REDACTION_CLASSES,
  ROLE_ID_PATTERN,
  SCOPE_SECTIONS,
  SECTION_VISIBILITY_MODES,
  DEFAULT_REDACTION_CLASS,
  TASK_REDACTION_CLASS,
  accessStateStreamIdOf,
  accessStreamIdOf,
  accessStreamSlugOf,
  actionOfActionKind,
} from './version';
export type {
  AccessActionKind,
  AccessProjectionEventDiscriminator,
  EvidenceScopeMode,
  ObjectClass,
  PolicyStatus,
  ProjectionAction,
  ProjectionPrincipalKind,
  RedactionClass,
  ScopeSection,
  SectionVisibility,
} from './version';

// The canonical JSON value space (the shared protocol grammar).
export type { JsonValue } from '@epoch/agent-protocol';

// Primitives (zod schemas + types + the shared W009/W036 grammars).
export {
  ACCESS_ACTIVITY_ID_MIRROR_PATTERN,
  AccessPrincipalIdSchema,
  AccessStreamIdSchema,
  ActivityIdMirrorSchema,
  AgentTaskClassSchema,
  AuditRecordIdSchema,
  FieldPathTemplateSchema,
  PolicyIdSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  RoleIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  TenantIdSchema,
  TimestampSchema,
  canonicalDigest,
  sha256Hex,
} from './primitives';
export type {
  AccessPrincipalId,
  AccessStreamId,
  ActivityIdMirror,
  AgentTaskClass,
  AuditRecordId,
  FieldPathTemplate,
  PolicyId,
  PositiveInteger,
  PrincipalId,
  RoleId,
  SemverCore,
  Sha256Hex,
  TenantId,
  Timestamp,
} from './primitives';

// Typed error taxonomy + result + denials.
export type {
  AccessProjectionError,
  AccessProjectionErrorCode,
  AccessProjectionIssue,
  AccessProjectionResult,
  AccessReferenceKind,
  ProjectionDenial,
  ProjectionDenialCode,
} from './errors';

// Canonical record surface (the W036 families this kernel projects).
export {
  CanonicalRecordSchema,
  canonicalObjectIdentity,
  canonicalRecordKey,
  canonicalRecordSchemaOf,
  canonicalTenantId,
  isObjectClass,
  verifyCanonicalRecord,
} from './records';
export type {
  CanonicalDeliveryRecord,
  CanonicalDistinctionRecord,
  CanonicalObjectIdentity,
  CanonicalProgramRecord,
  CanonicalRecord,
  CanonicalSolutionVersionRecord,
} from './records';

// Projection policies (policy is data).
export {
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
  bindingSelectorKey,
  computeProjectionPolicyDigest,
  policyBindingKey,
  redactionClassOf,
  sealProjectionPolicy,
  selectRoleBinding,
  selectTaskBinding,
  verifySealedProjectionPolicy,
} from './policy';
export type {
  BindingSelector,
  EvidenceScope,
  PolicyBinding,
  PolicyRevisionRef,
  ProjectionPolicyContent,
  ProjectionSubject,
  RedactionRule,
  ScopeFilters,
  SealedProjectionPolicy,
} from './policy';

// Agent task projection contexts.
export {
  TaskProjectionContextSchema,
  taskEscalationError,
} from './task';
export type { TaskProjectionContext } from './task';

// The zod-schema-driven field walk + template matching.
export {
  ancestorPrefixes,
  compileElementMatchers,
  compileTemplates,
  elementMatcher,
  matchesAnyTemplate,
  templateMatcher,
  walkSchemaLeaves,
} from './walk';
export type { LeafEntry } from './walk';

// The governed-section registry.
export { OBJECT_CLASS_SECTIONS } from './sections';
export type { ObjectClassSections } from './sections';

// Authorized projections (released-by-reference + redaction markers).
export {
  AuthorizedProjectionContentSchema,
  PolicyClauseRefSchema,
  ProjectionEntrySchema,
  RedactionMarkerSchema,
  ReleasedFieldSchema,
  SealedAuthorizedProjectionSchema,
  computeAuthorizedProjectionDigest,
  redactedPathsOf,
  releasedPathsOf,
  releasedValueOf,
  sealAuthorizedProjection,
  verifySealedAuthorizedProjection,
} from './projection';
export type {
  AuthorizedProjectionContent,
  PolicyClauseRef,
  ProjectionEntry,
  RedactionMarker,
  ReleasedField,
  SealedAuthorizedProjection,
} from './projection';

// The projection audit trail.
export {
  AppliedScopesSchema,
  AuditProvenanceSchema,
  ProjectionAuditContentSchema,
  SealedProjectionAuditSchema,
  auditRecordIdOf,
  computeProjectionAuditDigest,
  deriveEvaluationKey,
  kernelAuditProvenance,
  sealProjectionAudit,
  verifySealedProjectionAudit,
} from './audit';
export type {
  AppliedScopes,
  AuditProvenance,
  EvaluationKeyInputs,
  ProjectionAuditContent,
  SealedProjectionAudit,
} from './audit';

// The two-stage evaluation pipeline.
export {
  evaluateProjection,
  selectVisiblePaths,
} from './evaluate';
export type {
  PathSelection,
  ProjectionEvaluation,
  ProjectionEvaluationInput,
} from './evaluate';

// The W036 error adapter.
export { adaptDeliveryResult, mapDeliveryError } from './w036-adapter';

// The access-projection:* event vocabulary over the W010 event shapes.
export {
  ACCESS_PROJECTION_EVENT_DATA_SCHEMAS,
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
  computeAccessProjectionEventDigest,
  parseAccessProjectionEventData,
  sealAccessProjectionEvent,
  verifySealedAccessProjectionEvent,
} from './events';
export type {
  AccessProjectionCausalParent,
  AccessProjectionEventContent,
  AccessProjectionEventPayload,
  AccessProjectionEventSequence,
  AuditRecordedData,
  PolicyRegisteredData,
  ProjectionDeniedData,
  ProjectionReleasedData,
  RecordAdmittedData,
  SealedAccessProjectionEvent,
  StateProjectedData,
} from './events';

// The in-memory store (admissions, audit trail, derived state).
export {
  admitCanonicalRecord,
  admitProjection,
  admitProjectionPolicy,
  appendAuditRecord,
  findCanonicalRecord,
  findPolicyRevision,
  openAccessProjectionStore,
  projectAccessState,
} from './store';
export type {
  AccessProjectionStore,
  AccessStateProjection,
  AuditAdmission,
  AuditKeyBinding,
  PolicyAdmission,
  ProjectionAdmission,
  RecordAdmission,
} from './store';

// Published schema surface + contract emission.
export {
  ACCESS_PROJECTION_SCHEMA_SURFACE,
  CORE_RECORD_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  ACCESS_PROJECTION_CONTRACT_DIR,
  ACCESS_PROJECTION_PUBLIC_CONTRACT_DIR,
  renderAccessProjectionContractFiles,
  renderAccessProjectionPublicContractFiles,
  typeToKebabCase,
} from './contract-emission';
