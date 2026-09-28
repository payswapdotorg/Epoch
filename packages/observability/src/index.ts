/**
 * @epoch/observability — public API (kernel layer, Work Order W030).
 *
 * The SECURITY/ISOLATION/OBSERVABILITY kernel (architecture.md,
 * binding: "Public extensions are sandboxed and capability-scoped";
 * lock rule 10; R12 tenant isolation):
 *
 * - SECURITY OBSERVATIONS: typed, versioned, SEALED, content-addressed
 *   facts reported by (or about) the execution surfaces — every
 *   observation carries the W006 exact-revision provenance digest of
 *   its source record, the tenant scope, the acting principal, the
 *   closed class/outcome/severity vocabulary, and a bounded neutral
 *   detail record. Append-only; idempotent by id + digest.
 * - SECURITY POLICY IS DATA: tenant-scoped, sealed policies binding
 *   an ISOLATION PROFILE (max trust class, admitted flavors, admitted
 *   data-handling, listing requirement, quarantine-on-violation) and
 *   OBSERVABILITY THRESHOLDS (health flip points). Swapping the
 *   active policy revision changes enforcement with zero code change.
 * - THE SANDBOX ISOLATION CHECK: a deterministic pure predicate over
 *   a W008-mirrored sandbox subject description and an isolation
 *   profile — trust-class ceilings, the W008 grant-ceiling table,
 *   legal host functions / resource scopes, flavor + data-handling
 *   admission, capability-binding grounding, listing requirements.
 *   Fail-closed with the typed violation list.
 * - QUARANTINE: append-only impose/release facts; deny-by-default
 *   derived state; typed conflicts on double imposition / baseless
 *   release.
 * - METRICS + HEALTH: the deterministic fold over admitted
 *   observations and the derived security-health projection (healthy
 *   / degraded / critical) — projections, never authorities.
 * - THE AUDIT FAMILIES: tenant-boundary breach detection (the R12
 *   invariant verified against the observed record) and the W041
 *   access-projection invariant verification (identity preservation,
 *   redaction completeness, decision + policy linkage).
 * - The `security:*` event vocabulary over the W010 event shapes.
 *
 * In-memory reference behavior: NO persistence, NO network, NO UI, NO
 * provider vocabulary. Deterministic: zero wall-clock, zero
 * randomness — every instant is caller-supplied.
 *
 * Runtime dependency policy (W030 pin): @epoch/agent-protocol
 * (canonical JSON + SHA-256 digests + timestamps) and zod — NOTHING
 * else. Compatibility with @epoch/tenancy, @epoch/identity,
 * @epoch/event-log, @epoch/authorization, @epoch/extension-runtime
 * and @epoch/access-projection is pinned via devDependencies +
 * compile-time parity (src/kernel-parity.ts) and runtime parity tests
 * — never runtime deps.
 *
 * Versioned contract surface (the W024 in-package precedent): version
 * constants + typed index export (this file), runtime zod validators
 * (src/*.ts), and the committed JSON Schema projection under
 * schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  AUDIT_FINDING_CODES,
  ISOLATION_VIOLATION_CODES,
  OBSERVABILITY_CONTRACT_VERSION,
  OBSERVABILITY_EVENT_RECORD_VERSION,
  OBSERVABILITY_RECORD_VERSION,
  OBSERVATION_CLASSES,
  OBSERVATION_OUTCOMES,
  OBSERVATION_SEVERITIES,
  OBSERVATION_SUBJECT_KINDS,
  QUARANTINE_FACT_KINDS,
  SANDBOX_DATA_HANDLING,
  SANDBOX_FLAVORS,
  SANDBOX_GRANT_CEILINGS,
  SANDBOX_HOST_FUNCTIONS,
  SANDBOX_LEGAL_RESOURCE_SCOPES,
  SANDBOX_TRUST_CLASS_PATTERN,
  SECURITY_EVENT_DISCRIMINATORS,
  SECURITY_HEALTH_STATUSES,
  SECURITY_HOST_STREAM_ID_PATTERN,
  SECURITY_POLICY_ID_PATTERN,
  SECURITY_STREAM_ID_PATTERN,
  OBSERVATION_ID_PATTERN,
  QUARANTINE_ID_PATTERN,
  SUBJECT_ID_PATTERN,
  OBSERVABILITY_PRINCIPAL_ID_PATTERN,
  OBSERVABILITY_TENANT_ID_PATTERN,
  kindPrefixOf,
  securityHostStreamIdOf,
  securityStreamIdOf,
} from './version';
export type {
  AuditFindingCode,
  IsolationViolationCode,
  ObservationClass,
  ObservationOutcome,
  ObservationSeverity,
  ObservationSubjectKind,
  QuarantineFactKind,
  SandboxDataHandling,
  SandboxFlavor,
  SandboxGrantCeiling,
  SandboxTrustClassToken,
  SecurityEventDiscriminator,
  SecurityHealthStatus,
} from './version';

// Primitives (zod schemas + mirrored id grammars).
export {
  CapabilityBindingTokenSchema,
  HostFunctionTokenSchema,
  JsonValueSchema,
  NonNegativeIntegerSchema,
  ObservationIdSchema,
  PrincipalIdSchema,
  QuarantineIdSchema,
  ResourceScopeTokenSchema,
  SandboxTrustClassSchema,
  SecurityHostStreamIdSchema,
  SecurityPolicyIdSchema,
  SecurityStreamIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SubjectIdSchema,
  TenantIdSchema,
  TimestampSchema,
} from './primitives';
export type {
  CapabilityBindingToken,
  HostFunctionToken,
  JsonValue,
  NonNegativeInteger,
  ObservationId,
  PrincipalId,
  QuarantineId,
  ResourceScopeToken,
  SecurityPolicyId,
  SecurityStreamId,
  SemverCore,
  Sha256Hex,
  SubjectId,
  TenantId,
  Timestamp,
} from './primitives';

// Typed error taxonomy + result.
export type {
  IsolationViolation,
  ObservabilityError,
  ObservabilityErrorCode,
  ObservabilityIssue,
  ObservabilityResult,
} from './errors';

// Security policies (policy is data).
export {
  POLICY_STATUSES,
  IsolationProfileSchema,
  PolicyStatusSchema,
  SealedSecurityPolicySchema,
  SecurityPolicyContentSchema,
  SecurityThresholdsSchema,
  computeSecurityPolicyDigest,
  sealSecurityPolicy,
  selectActivePolicy,
  verifySealedSecurityPolicy,
} from './policy';
export type {
  IsolationProfile,
  PolicyStatus,
  SealedSecurityPolicy,
  SecurityPolicyContent,
  SecurityThresholds,
} from './policy';

// Sandbox subjects (the W008 surface mirror) + the isolation check.
export {
  SandboxBindingSchema,
  SandboxGrantSchema,
  SandboxSubjectSchema,
} from './subject';
export type { SandboxBinding, SandboxGrant, SandboxSubject } from './subject';
export { checkIsolation } from './isolation';
export type { IsolationVerdict } from './isolation';

// Observations (the audit atoms).
export {
  ObservationClassSchema,
  ObservationContentSchema,
  ObservationOutcomeSchema,
  ObservationProvenanceSchema,
  ObservationSeveritySchema,
  ObservationSubjectKindSchema,
  SealedObservationSchema,
  computeObservationDigest,
  sealObservation,
  verifySealedObservation,
} from './observation';
export type {
  ObservationContent,
  ObservationProvenance,
  SealedObservation,
} from './observation';

// Quarantine facts.
export {
  QuarantineFactContentSchema,
  QuarantineFactKindSchema,
  SealedQuarantineFactSchema,
  computeQuarantineDigest,
  isSubjectQuarantined,
  quarantinedSubjectsOf,
  sealQuarantineFact,
  verifySealedQuarantineFact,
} from './quarantine';
export type { QuarantineFactContent, SealedQuarantineFact } from './quarantine';

// Metrics + health.
export {
  METRIC_COUNTERS,
  foldObservations,
  zeroMetrics,
} from './metrics';
export type {
  MetricCounter,
  ObservabilityMetrics,
  PerClassCounts,
  PerOutcomeCounts,
  PerSeverityCounts,
} from './metrics';
export { projectSecurityHealth } from './health';
export type { SecurityHealth } from './health';

// The audit families.
export {
  CanonicalObjectRefSchema,
  ProjectionSummarySchema,
  auditProjectionSummary,
  auditTenantBoundary,
  auditTenantBoundaryObservation,
} from './audit';
export type { AuditFinding, CanonicalObjectRef, ProjectionSummary } from './audit';

// The security:* event vocabulary over the W010 event shapes.
export {
  SECURITY_EVENT_DATA_SCHEMAS,
  SealedSecurityEventSchema,
  SecurityCausalParentSchema,
  SecurityEventContentSchema,
  SecurityEventPayloadSchema,
  SecurityEventSequenceSchema,
  AuditRecordedDataSchema,
  HealthProjectedDataSchema,
  ObservationRecordedDataSchema,
  PolicyRegisteredDataSchema,
  QuarantineImposedDataSchema,
  QuarantineReleasedDataSchema,
  ViolationDetectedDataSchema,
  computeSecurityEventDigest,
  isSecurityEventDiscriminator,
  parseSecurityEventData,
  sealSecurityEvent,
  verifySealedSecurityEvent,
} from './events';
export type {
  AuditRecordedData,
  HealthProjectedData,
  ObservationRecordedData,
  PolicyRegisteredData,
  QuarantineImposedData,
  QuarantineReleasedData,
  SealedSecurityEvent,
  SecurityCausalParent,
  SecurityEventContent,
  SecurityEventPayload,
  SecurityEventSequence,
  ViolationDetectedData,
} from './events';

// The reference in-memory store.
export {
  ObservabilityStore,
} from './store';
export type {
  ObservabilitySnapshot,
  ObservabilityStateProjection,
  ObservabilityStoreOptions,
  StateProjectionOptions,
  SubjectStream,
} from './store';

// Published schema surface + deterministic contract emission.
export {
  OBSERVABILITY_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  OBSERVABILITY_CONTRACT_DIR,
  renderObservabilityContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Issue helpers (zod -> typed issues; the W006/W007 style).
export { flattenIssues, validationError } from './issues';
