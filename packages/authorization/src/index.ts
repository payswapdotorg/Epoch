/**
 * @epoch/authorization — public API (kernel layer, Work Order W009).
 *
 * The typed DECISION POINT over opaque principal/tenant/resource ids
 * (architecture.md "Tenancy" + the W009 architecture direction,
 * binding): authorization requests (principal id + tenant scope +
 * resource reference + action), typed decisions (allow/deny/
 * not-applicable + reasons + exact evidence paths), a fail-closed
 * decision pipeline, and content-addressed decision records.
 *
 * - NOT a policy engine: policy semantics stay in W004
 *   (@epoch/policy-contracts); the decision point defers policy
 *   evaluation to the host-wired {@link AuthorizationFacts} interface
 *   (W022 Action Gateway / W014 app shell wire identity + tenancy +
 *   policy behind it). Kernel-to-kernel shape compatibility is pinned
 *   by devDependencies + compile-time/runtime parity tests —
 *   @epoch/agent-protocol is the ONLY @epoch runtime dependency.
 * - Tenant isolation (R12): cross-tenant authorization is DENIED with
 *   a typed error BY CONSTRUCTION — no code path turns a non-member
 *   principal's request into an allow.
 * - Fail-closed taxonomy: unknown-principal, unknown-tenant,
 *   cross-tenant-denied, not-applicable (no policy source wired),
 *   evaluation-failed (policy evaluation failed), plus validation and
 *   digest-mismatch (tamper detection).
 * - Every issued decision is content-addressed: the record's
 *   `decisionDigest` is the SHA-256 of the decision's canonical JSON
 *   (exact-revision evidence, R17); parse REJECTS records whose claimed
 *   digest does not match their content.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts), and the committed JSON Schema projection under
 * schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  AUTHORIZATION_CONTRACT_VERSION,
  AUTHORIZATION_RECORD_VERSION,
  DECISION_OUTCOMES,
  DECISION_REASON_CODES,
} from './version';
export type { DecisionOutcome, DecisionReasonCode } from './version';

// Published contract types.
export type {
  ActionKind,
  AuthorizationContext,
  AuthorizationDecision,
  AuthorizationError,
  AuthorizationErrorCode,
  AuthorizationFacts,
  AuthorizationIssue,
  AuthorizationRecord,
  AuthorizationRequest,
  AuthorizationResult,
  DecisionReason,
  EvidencePath,
  PolicyEvaluationOutcome,
  PolicyTargetProjection,
  PrincipalId,
  PrincipalResolution,
  ResourceId,
  ResourceReference,
  ResourceType,
  TenantId,
  TenantResolution,
} from './types';

// Runtime validators.
export {
  ACTION_KIND_PATTERN,
  ActionKindSchema,
  AuthorizationContextSchema,
  AuthorizationDecisionSchema,
  AuthorizationRecordSchema,
  AuthorizationRecordVersionSchema,
  AuthorizationRequestSchema,
  DecisionOutcomeSchema,
  DecisionReasonCodeSchema,
  DecisionReasonSchema,
  EvidencePathSchema,
  POLICY_TAG_PATTERN,
  PolicyTagSchema,
  PolicyTargetProjectionSchema,
  PRINCIPAL_ID_PATTERN,
  PrincipalIdSchema,
  RESOURCE_ID_PATTERN,
  ResourceIdSchema,
  ResourceReferenceSchema,
  RESOURCE_TYPE_PATTERN,
  ResourceTypeSchema,
  SHA256_HEX_PATTERN,
  Sha256DigestSchema,
  TENANT_ID_PATTERN,
  TenantIdSchema,
} from './schema';

// Total parse surface.
export {
  parseAuthorizationDecision,
  parseAuthorizationRecord,
  parseAuthorizationRequest,
} from './parse';

// Digest discipline (canonical SHA-256 content addressing + tamper detection).
export {
  computeAuthorizationDecisionDigest,
  sealAuthorizationDecision,
  verifyAuthorizationDecisionDigest,
} from './digest';

// The decision point.
export {
  AuthorizationDecisionPoint,
  projectPolicyTarget,
  type DecideOptions,
} from './decision-point';

// Compile-time contract parity (type-only).
export type {
  AuthorizationLiteralSync,
  AuthorizationResultSync,
  AuthorizationSchemaSync,
} from './parity';

// Published schema surface + contract emission.
export { AUTHORIZATION_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  AUTHORIZATION_CONTRACT_DIR,
  renderAuthorizationContractFiles,
  typeToKebabCase,
} from './contract-emission';
