/**
 * @epoch/evidence — public API (kernel layer, Work Order W006).
 *
 * Exact-revision, content-addressed evidence records:
 * - every record refers to the EXACT artifact revision it is about via a
 *   proof-grade SHA-256 content digest (`ExactRevisionRef`);
 * - a record's identity is the SHA-256 of its canonical JSON serialization
 *   (content addressing — `computeEvidenceDigest`);
 * - uncertainty travels with evidence: every record carries a `Confidence`
 *   structurally identical to the W002 world-model confidence model;
 * - the evidence kind vocabulary matches the W002 world-model `EvidenceKind`
 *   so world-model `EvidenceRef`s mirror evidence records without loss.
 *
 * Evidence semantics and formats are owned here (W006); the world model
 * holds only opaque evidence references, and providers stay behind adapters
 * (provider neutrality, architecture lock rule 13).
 *
 * Versioned contract surface: version constants + typed index export (this
 * file), runtime zod validators (src/schema.ts), compile-time parity
 * (src/parity.ts, part of typecheck), and the committed JSON Schema
 * projection under schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  CONFIDENCE_METHODS,
  EVIDENCE_CONTRACT_VERSION,
  EVIDENCE_KINDS,
  EVIDENCE_RECORD_VERSION,
  INTERVAL_BIASES,
} from './version';

// Published contract types.
export type {
  Confidence,
  ConfidenceDistribution,
  ConfidenceMethod,
  EvidenceIssue,
  EvidenceIssueCode,
  EvidenceKind,
  EvidencePayload,
  EvidenceProduction,
  EvidenceReceipt,
  EvidenceRecord,
  ExactRevisionRef,
  IntervalBias,
} from './types';

// Runtime validators.
export {
  ConfidenceDistributionSchema,
  ConfidenceMethodSchema,
  ConfidenceSchema,
  EvidenceKindSchema,
  EvidencePayloadSchema,
  EvidenceProductionSchema,
  EvidenceRecordSchema,
  EvidenceVersionSchema,
  ExactRevisionRefSchema,
  IntervalBiasSchema,
  MEDIA_TYPE_PATTERN,
  SHA256_HEX_PATTERN,
  Sha256DigestSchema,
} from './schema';

// Compile-time contract parity (type-only).
export type { EvidenceLiteralSync, EvidenceSchemaSync } from './parity';

// Total parse surface.
export { parseEvidenceRecord, type EvidenceParse } from './parse';

// Digest discipline (canonical SHA-256 content addressing).
export {
  computeEvidenceDigest,
  verifyArtifactRevision,
  verifyEvidenceRecord,
} from './digest';

// Content-addressed reference store.
export {
  EvidenceStore,
  type ArtifactLookupFilter,
  type EvidenceStoreResult,
} from './store';

export { EvidenceError } from './errors';

// Published schema surface + contract emission.
export { EVIDENCE_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export { EVIDENCE_CONTRACT_DIR, renderEvidenceContractFiles, typeToKebabCase } from './contract-emission';
