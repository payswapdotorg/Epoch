/**
 * @epoch/document-adapter — public API (kernel layer, Work Order W028).
 *
 * The Document-to-Adapter derivation MODEL:
 * - documents are TYPED BYTES + content-addressed descriptors (SHA-256
 *   over canonical bytes via the agent-protocol machinery);
 * - the derivation pipeline
 *   Uploaded -> Parsed -> CandidatesExtracted -> ReviewPending ->
 *   Provisional is typed data; EVERY stage emits a W006 evidence record
 *   (@epoch/evidence — genuine runtime consumption) chained to the
 *   document digest, and a candidate with a broken chain is rejected;
 * - extraction is deterministic: identical (document bytes, descriptor,
 *   run context) derive identical candidates and evidence (zero
 *   wall-clock, zero randomness — timestamps are host-supplied typed
 *   inputs); no stage mutates kernel state (pure projection);
 * - every document-derived mapping registers against the W007
 *   source-category vocabulary (@epoch/capability-registry — genuine
 *   runtime consumption) with origin `provisional-document-derived`;
 * - provisional by construction: the lifecycle is TERMINAL at
 *   `provisional`, and certify / execute / grant-capability requests are
 *   the typed rejection `trust-escalation-denied` (the floor, not the
 *   gate — spec/extension-architecture.md, binding);
 * - tenant-scoped everywhere: cross-tenant access is the typed rejection
 *   `cross-tenant-denied` (R12);
 * - provider-neutral: zero vendor document services, keys, or clients;
 *   real-world formats are future adapters behind this seam.
 *
 * Versioned contract surface: version constants + typed index export (this
 * file), runtime zod validators (src/schema.ts), compile-time parity
 * (src/parity.ts, part of typecheck), and the committed JSON Schema
 * projection under schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  CANDIDATE_ID_PATTERN,
  DEFINITION_ID_PATTERN,
  DOCUMENT_ADAPTER_CONTRACT_ID,
  DOCUMENT_ADAPTER_CONTRACT_VERSION,
  DOCUMENT_ADAPTER_ERROR_CODES,
  DOCUMENT_DERIVED_TRUST_CLASS,
  DOCUMENT_FORMATS,
  DOCUMENT_FORMAT_MEDIA_TYPES,
  DOCUMENT_ID_PATTERN,
  DOCUMENT_RECORD_VERSION,
  EXTRACTION_STAGE_KINDS,
  PROJECT_ID_PATTERN,
  PROPERTY_NAME_PATTERN,
  PROVISIONAL_CAPABILITY_CATEGORY,
  PROVISIONAL_CAPABILITY_ORIGIN,
  PROVISIONAL_CAPABILITY_VERSION,
  PROVISIONAL_LIFECYCLE_TRANSITIONS,
  PROVISIONAL_TRUST_CEILING,
  SEMANTIC_TYPE_KEY_PATTERN,
  SOURCE_PATH_PATTERN,
  STAGE_EVIDENCE_KINDS,
  TENANT_ID_PATTERN,
  TRUST_ESCALATION_OPS,
  WORKSPACE_ID_PATTERN,
} from './version';
export type {
  DocumentAdapterErrorCode,
  DocumentFormat,
  ExtractionStageKind,
  TrustEscalationOp,
} from './version';

// Published contract types.
export type {
  CandidateId,
  DocumentAdapterError,
  DocumentAdapterIssue,
  DocumentAdapterResult,
  DocumentContent,
  DocumentDescriptor,
  DocumentFieldLocator,
  DocumentId,
  ExtractionCandidate,
  ParsedDocument,
  ParsedMappingRow,
  ProjectId,
  PropertyMapping,
  ProvisionalAdapterDefinition,
  ProvisionalRegistrationPlan,
  DefinitionId,
  StageEvidenceChain,
  StageEvidenceLink,
  StageRunContext,
  TenantId,
  TenantScope,
  WorkspaceId,
} from './types';

// Runtime validators.
export {
  CandidateIdSchema,
  DefinitionIdSchema,
  DocumentAdapterIssueSchema,
  DocumentContentSchema,
  DocumentDescriptorSchema,
  DocumentFieldLocatorSchema,
  DocumentFormatSchema,
  DocumentIdSchema,
  ExtractionCandidateSchema,
  ExtractionStageKindSchema,
  ParsedDocumentSchema,
  ParsedMappingRowSchema,
  ProjectIdSchema,
  PropertyMappingSchema,
  PropertyNameSchema,
  ProvisionalAdapterDefinitionSchema,
  ProvisionalRegistrationPlanSchema,
  SemanticTypeKeySchema,
  SHA256_HEX_PATTERN,
  SourcePathSchema,
  StageEvidenceChainSchema,
  StageEvidenceLinkSchema,
  StageRunContextSchema,
  TenantIdSchema,
  TenantScopeSchema,
  TrustEscalationOpSchema,
  WorkspaceIdSchema,
} from './schema';

// Canonical bytes + digest discipline.
export {
  DOCUMENT_REVISION_LABEL,
  canonicalByteLength,
  canonicalDocumentBytes,
  computeDocumentDigest,
  deriveDocumentDescriptor,
  documentArtifactId,
} from './canonical';

// Deterministic admission + extraction.
export {
  admitDocumentContent,
  admitDocumentDescriptor,
  extractCandidates,
  parseDocument,
  validateCandidate,
} from './extract';
export type { AdmissionOptions, ParseDocumentOptions } from './extract';

// Stage evidence emission + chain verification (W006 consumption).
export {
  STAGE_EVIDENCE_MEDIA_TYPE,
  chainCovers,
  chainLength,
  chainPrefix,
  emitStageEvidence,
  extendChain,
  initialChain,
  stageEvidencePayload,
  verifyEvidenceChain,
} from './evidence';
export type {
  EvidenceRecordLookup,
  StageEvidenceInput,
  StageEvidencePayload,
  StageEvidenceReceipt,
} from './evidence';

// Provenance verification (evidence-first gate).
export {
  CANDIDATE_CHAIN_STAGES,
  DEFINITION_CHAIN_STAGES,
  verifyCandidateProvenance,
  verifyDefinitionProvenance,
} from './provenance';
export type { BrokenChainReason } from './provenance';

// Provisional lifecycle + trust-escalation floor.
export {
  PIPELINE_LENGTH,
  PIPELINE_SEQUENCE,
  advanceExtractionStage,
  legalSuccessors,
  requestTrustEscalation,
  stageIndexOf,
} from './lifecycle';
export type { AdvanceStageInput, TrustEscalationRequest } from './lifecycle';

// W007 source-category registration shapes.
export {
  buildProvisionalRegistration,
  deriveProvisionalDefinitions,
  deriveRegistrationPlan,
} from './registration';
export type {
  ProvisionalDerivationInput,
  ProvisionalDerivationOutput,
  RegistrationBuildInput,
  RegistrationPlanInput,
} from './registration';

// Total parse surface.
export {
  parseDocumentDescriptor,
  parseExtractionCandidate,
  parseProvisionalAdapterDefinition,
  parseStageEvidenceChain,
} from './parse';
export type { ParseOptions } from './parse';

// Typed error taxonomy.
export {
  DocumentAdapterErrorSchema,
  isDocumentAdapterError,
  trustEscalationDenied,
} from './errors';
export type { TrustEscalationDenialInput } from './errors';

// Compile-time contract parity (type-only).
export type { DocumentAdapterSchemaSync } from './parity';

// Published schema surface + contract emission.
export { DOCUMENT_ADAPTER_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  DOCUMENT_ADAPTER_CONTRACT_DIR,
  renderDocumentAdapterContractFiles,
  typeToKebabCase,
} from './contract-emission';
