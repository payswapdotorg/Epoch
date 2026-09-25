/**
 * @epoch/tenancy — public API (kernel layer, Work Order W009).
 *
 * The tenancy hierarchy (architecture.md, "Tenancy", binding):
 * `Platform -> Tenant -> Workspace -> Project -> World/Scenario/Evidence`,
 * modeled as typed OPAQUE-ID REFERENCES (the W002/W003 house pattern — a
 * workspace references its tenant by id, never by embedding tenant
 * objects).
 *
 * - Identity != tenancy != authorization != policy (architecture lock
 *   rule 12): this package owns the containment hierarchy ONLY.
 *   Principals live in @epoch/identity, decisions in
 *   @epoch/authorization, policy semantics in @epoch/policy-contracts
 *   (W004) — all wired together by hosts (W014+/W022), never by runtime
 *   dependencies between the W009 packages.
 * - Provider-NEUTRAL by construction (lock rule 13): strict objects
 *   reject unknown (vendor) fields; every identifier is opaque.
 * - Tenant isolation is a security boundary (R12): cross-tenant
 *   references, hierarchy escapes, and traversals without membership are
 *   typed, named, tested rejections.
 * - Reference in-memory directory: NO persistence, NO events, NO
 *   authorization logic, NO clocks (determinism); records are plain
 *   serialization-friendly JSON and iteration is always sorted.
 * - Content addressing: node records seal with the SHA-256 of their
 *   canonical JSON; admission REJECTS digest mismatches (tamper
 *   detection).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts), and the committed JSON Schema projection under
 * schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  TENANCY_CONTRACT_VERSION,
  TENANCY_KIND_ID_PREFIXES,
  TENANCY_NODE_DEPTHS,
  TENANCY_NODE_KINDS,
  TENANCY_PARENT_KINDS,
  TENANCY_RECORD_VERSION,
  legalParentKinds,
} from './version';
export type { TenancyNodeKind } from './version';

// Published contract types.
export type {
  EvidenceId,
  PlatformId,
  ProjectId,
  ScenarioId,
  SealedTenancyNode,
  TenancyError,
  TenancyErrorCode,
  TenancyIssue,
  TenancyMembership,
  TenancyNode,
  TenancyNodeId,
  TenancyResult,
  TenancySnapshot,
  TenantId,
  WorkspaceId,
  WorldId,
} from './types';

// Runtime validators.
export {
  EVIDENCE_ID_PATTERN,
  PLATFORM_ID_PATTERN,
  PROJECT_ID_PATTERN,
  SCENARIO_ID_PATTERN,
  SHA256_HEX_PATTERN,
  SealedTenancyNodeSchema,
  Sha256DigestSchema,
  TENANCY_ID_SLUG_PATTERN,
  TENANCY_NODE_ID_PATTERN,
  TenancyNodeKindSchema,
  TenancyNodeIdSchema,
  TenancyNodeSchema,
  TenancyRecordVersionSchema,
  TenancySnapshotSchema,
  TENANT_ID_PATTERN,
  TenantIdSchema,
  WORKSPACE_ID_PATTERN,
  WorkspaceIdSchema,
  WORLD_ID_PATTERN,
  WorldIdSchema,
  PlatformIdSchema,
  ProjectIdSchema,
  ScenarioIdSchema,
  EvidenceIdSchema,
} from './schema';

// Total parse surface.
export {
  parseSealedTenancyNode,
  parseTenancyNode,
  parseTenancySnapshot,
} from './parse';

// Digest discipline (canonical SHA-256 content addressing + tamper detection).
export {
  computeTenancyNodeDigest,
  sealTenancyNode,
  verifyTenancyNodeDigest,
} from './digest';

// The reference in-memory tenancy directory.
export {
  TenancyDirectory,
  type CreateNodeInput,
  type CreatePlatformInput,
} from './directory';

// Compile-time contract parity (type-only).
export type {
  TenancyLiteralSync,
  TenancyResultSync,
  TenancySchemaSync,
} from './parity';

// Published schema surface + contract emission.
export { TENANCY_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  TENANCY_CONTRACT_DIR,
  renderTenancyContractFiles,
  typeToKebabCase,
} from './contract-emission';
