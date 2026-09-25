/**
 * @epoch/tenancy — public API (kernel layer, Work Order W009).
 *
 * The tenancy hierarchy (architecture.md, binding): Platform -> Tenant ->
 * Workspace -> Project -> World/Scenario/Evidence, referenced through
 * opaque typed ids — never through embedded objects.
 *
 * - Tenancy owns the CONTAINER HIERARCHY only. Identity != tenancy !=
 *   authorization != policy (lock rule 12): principals are
 *   @epoch/identity's authority, decisions are @epoch/authorization's,
 *   policy semantics are @epoch/policy-contracts'.
 * - Provider-NEUTRAL by construction (lock rule 13): every identifier is
 *   an opaque kind-prefixed slug; strict objects reject unknown (vendor)
 *   fields.
 * - Reference in-memory hierarchy: NO persistence, NO event log, NO UI,
 *   NO principal membership (later Work Orders); records are plain
 *   serialization-friendly JSON.
 * - Tenant isolation is a security boundary (R12): reparenting across
 *   tenants is rejected with the typed `cross-tenant-reference` error.
 *
 * Versioned contract surface: version constants + typed index export (this
 * file), runtime zod validators (src/schema.ts), compile-time parity
 * (src/parity.ts), and the committed JSON Schema projection under schemas/
 * pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  TENANCY_CONTRACT_VERSION,
  TENANCY_NODE_ID_PATTERN,
  TENANCY_NODE_KINDS,
  TENANCY_PARENT_KINDS,
  TENANCY_RECORD_VERSION,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
  PROJECT_ID_PATTERN,
  kindPrefixOf,
} from './version';

// Published contract types.
export type {
  TenancyError,
  TenancyErrorCode,
  TenancyIssue,
  TenancyNode,
  TenancyNodeKind,
  TenancyNodeId,
  TenancyNodeRecord,
  TenancyNodeRegistration,
  TenancyResult,
  TenancySnapshot,
  TenantId,
  WorkspaceId,
  ProjectId,
} from './types';

// Runtime validators.
export {
  SHA256_HEX_PATTERN,
  TenancyNodeKindSchema,
  TenancyNodeIdSchema,
  TenancyNodeRecordSchema,
  TenancyNodeSchema,
  TenancyRecordVersionSchema,
  TenancySnapshotSchema,
  TenantIdSchema,
  WorkspaceIdSchema,
  ProjectIdSchema,
  Sha256DigestSchema,
} from './schema';

// Total parse surface.
export {
  parseTenancyNode,
  parseTenancyNodeRecord,
  parseTenancySnapshot,
} from './parse';

// Digest discipline (canonical SHA-256 content addressing + tamper detection).
export {
  computeTenancyNodeDigest,
  sealTenancyNode,
  tenancyNodeRecordFor,
  verifyTenancyNodeDigest,
} from './digest';

// The reference in-memory hierarchy.
export {
  TenancyHierarchy,
  type ListNodesFilter,
  type MoveNodeInput,
} from './hierarchy';

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
