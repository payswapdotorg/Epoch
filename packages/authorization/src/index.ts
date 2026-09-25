/**
 * @epoch/authorization — public API (kernel layer, Work Order W009).
 *
 * The authorization DECISION POINT (architecture.md, binding):
 * "Identity != tenancy != authorization != policy" — authorization owns
 * decisions over opaque principal/tenant/resource ids.
 *
 * - A decision point, NOT a policy engine: it never evaluates
 *   constraints; policy semantics are @epoch/policy-contracts' (W004).
 *   Shape compatibility is pinned via devDependencies + parity tests
 *   (test/w004-parity.*) — no runtime coupling.
 * - Fail-closed: unknown principals/tenants are DENIED with typed
 *   codes, never error-open; cross-tenant access is denied BY
 *   CONSTRUCTION (R12, the tenant isolation boundary).
 * - Deterministic: the evaluator canonicalizes caller-supplied facts
 *   before matching, so contexts that differ only in array order
 *   produce byte-identical decisions; decisions are content-addressed
 *   (SHA-256 over canonical JSON) and reference the exact request
 *   revision by digest.
 * - Provider-neutral (lock rule 13): every identifier is opaque; strict
 *   objects reject unknown (vendor) fields.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts), and the committed JSON Schema projection under
 * schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies (id patterns/status mirror tenancy+identity; parity-pinned).
export {
  ALLOW_REASONS,
  AUTHORIZATION_CONTRACT_VERSION,
  AUTHORIZATION_OUTCOMES,
  AUTHORIZATION_RECORD_VERSION,
  DENIAL_CODES,
  EVIDENCE_PATH_PATTERN,
  NOT_APPLICABLE_REASONS,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_STATUSES,
  PROJECT_ID_PATTERN,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
} from './version';

// Published contract types.
export type {
  AllowDecision,
  AllowReason,
  AuthorizationContext,
  AuthorizationDecision,
  AuthorizationError,
  AuthorizationErrorCode,
  AuthorizationIssue,
  AuthorizationOutcome,
  AuthorizationPolicyTarget,
  AuthorizationRequest,
  AuthorizationResult,
  Denial,
  DenialCode,
  DenyDecision,
  EvidencePath,
  MembershipFact,
  NotApplicableDecision,
  NotApplicableReason,
  PrincipalFact,
  PrincipalId,
  PrincipalStatus,
  ProjectId,
  ResourceReference,
  TenantId,
  WorkspaceId,
} from './types';

// Runtime validators.
export {
  SHA256_HEX_PATTERN,
  AllowDecisionSchema,
  AllowReasonSchema,
  AuthorizationContextSchema,
  AuthorizationDecisionSchema,
  AuthorizationOutcomeSchema,
  AuthorizationPolicyTargetSchema,
  AuthorizationRecordVersionSchema,
  AuthorizationRequestSchema,
  DenialCodeSchema,
  DenialSchema,
  DenyDecisionSchema,
  EvidencePathSchema,
  MembershipFactSchema,
  NotApplicableDecisionSchema,
  NotApplicableReasonSchema,
  PrincipalFactSchema,
  PrincipalIdSchema,
  PrincipalStatusSchema,
  ProjectIdSchema,
  ResourceReferenceSchema,
  Sha256DigestSchema,
  TenantIdSchema,
  WorkspaceIdSchema,
} from './schema';

// The decision point.
export { evaluate, toPolicyTarget } from './evaluate';

// Total parse surface.
export {
  parseAuthorizationContext,
  parseAuthorizationRequest,
  parseSealedAuthorizationDecision,
} from './parse';

// Digest discipline (canonical SHA-256 content addressing + tamper detection).
export {
  computeAuthorizationDecisionDigest,
  computeAuthorizationRequestDigest,
  sealAuthorizationDecision,
  verifyAuthorizationDecisionDigest,
  type AuthorizationDecisionRegistration,
} from './digest';

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
