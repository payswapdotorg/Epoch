/**
 * @epoch/provenance — public API (kernel layer, Work Order W006).
 *
 * First-class provenance (R5, R17): typed actor -> activity -> entity
 * chains in a PROV-DM-adapted model. Who/what produced an artifact, by
 * which method, from which inputs, when — expressed as agents, activities,
 * and entities connected by the six core PROV relations. The surface is
 * PROV-friendly without importing a PROV library; identifiers stay opaque
 * and provider-neutral.
 *
 * Versioned contract surface: version constants + typed index export (this
 * file), runtime zod validators (src/schema.ts), compile-time parity
 * (src/parity.ts), and the committed JSON Schema projection under schemas/
 * pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  PROVENANCE_AGENT_KINDS,
  PROVENANCE_CONTRACT_VERSION,
  PROVENANCE_RECORD_VERSION,
  PROVENANCE_RELATIONS,
} from './version';

// Published contract types.
export type {
  ProvenanceActivity,
  ProvenanceAgent,
  ProvenanceAgentKind,
  ProvenanceEntity,
  ProvenanceGraph,
  ProvenanceIssue,
  ProvenanceIssueCode,
  ProvenanceRelation,
  ProvenanceStatement,
} from './types';

// Runtime validators.
export {
  ProvenanceActivitySchema,
  ProvenanceAgentKindSchema,
  ProvenanceAgentSchema,
  ProvenanceEntitySchema,
  ProvenanceGraphSchema,
  ProvenanceRelationSchema,
  ProvenanceStatementSchema,
  ProvenanceVersionSchema,
} from './schema';

// Compile-time contract parity (type-only).
export type { ProvenanceLiteralSync, ProvenanceSchemaSync } from './parity';

// Total parse/admission surface.
export {
  admitProvenanceGraph,
  parseProvenanceGraph,
  type ProvenanceParse,
} from './parse';

// Semantic reference validation.
export { validateProvenanceGraph, type ProvenanceValidation } from './validate';

// Digest discipline (canonical SHA-256 content addressing).
export { computeProvenanceDigest, ProvenanceError } from './digest';

// Published schema surface + contract emission.
export { PROVENANCE_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  PROVENANCE_CONTRACT_DIR,
  renderProvenanceContractFiles,
  typeToKebabCase,
} from './contract-emission';
