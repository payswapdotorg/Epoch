/**
 * @epoch/adapter-ifc — public API (service layer, Work Order W029).
 *
 * The building-model REFERENCE adapter (the exchange standard's
 * vocabulary is quarantined in src/provider). Two W007 surfaces:
 *
 * - SOURCE: content-addressed, idempotent model ingestion + the typed
 *   observation of the external building-model artifact (exact-revision
 *   source reference, provenance, confidence — the W006 conventions);
 * - SEMANTIC: the deterministic projection of building elements,
 *   properties, and relationships INTO the W002 world-model graph as
 *   REAL assertion-input records (external-standard semantics are
 *   ADAPTED, never authoritative — the typed
 *   `external-semantics-not-authority` boundary).
 *
 * Cross-cutting invariants (tested): tenant isolation
 * (`tenant-isolation-rejected`), tamper detection (`digest-mismatch`),
 * idempotent replay (duplicate = sealed prior record; different content
 * under a key = `replay-conflict`), `ingestion-rejected` with reason on
 * malformed/incomplete input (never a partial silent load), determinism
 * (same fixture -> identical projection digest), provider neutrality
 * (per-adapter blocklist), and W007 registration under the source +
 * semantic categories.
 *
 * In-memory reference behavior: NO network, NO live exchange-format
 * parsers, NO real side effects — fixtures stand in for provider
 * payloads. Zero wall-clock, zero randomness.
 *
 * Runtime dependency policy (W029 Tech Lead pin, frozen):
 * @epoch/adapter-sdk, @epoch/agent-protocol, @epoch/world-model,
 * @epoch/tenancy, and zod — NOTHING else at runtime. Compatibility with
 * @epoch/capability-registry, @epoch/evidence, @epoch/event-log and
 * @epoch/action-policy is exercised via devDependencies + compile-time
 * parity (src/parity.ts) + runtime parity tests — never runtime deps.
 */

// Version + vocabularies.
export {
  CONSTRUCTION_DOMAIN_NAMESPACE,
  CONSTRUCTION_ENTITY_TYPES,
  CONSTRUCTION_RELATION_TYPES,
  IFC_ADAPTER_CATEGORIES,
  IFC_ADAPTER_CONTRACT_VERSION,
  IFC_ADAPTER_RECORD_VERSION,
  IFC_SEMANTIC_CONTRACT_ID,
  IFC_SOURCE_CONTRACT_ID,
  INGESTION_DISPOSITIONS,
} from './version';
export type {
  ConstructionEntityType,
  ConstructionRelationType,
  IngestionDisposition,
} from './version';

// Published contract types (the NEUTRAL seam).
export type {
  BuildingModelObservation,
  BuildingModelProjection,
  BuildingModelSourceRef,
  ModelIngestionRecord,
} from './types';

// Typed error taxonomy (values, never thrown).
export type {
  IfcAdapterError,
  IfcAdapterErrorCode,
  IfcAdapterIssue,
  IfcAdapterResult,
} from './errors';

// Runtime validators (the NEUTRAL seam).
export {
  BuildingModelIdSchema,
  BuildingModelObservationSchema,
  BuildingModelProjectionSchema,
  BuildingModelSourceRefSchema,
  IngestModelInputSchema,
  ModelIngestionRecordSchema,
  ProjectionRequestSchema,
} from './schema';

// The provider seam (the standard's vocabulary — fixtures + payload parsing).
export {
  admissionProblemOf,
  PROVIDER_ENTITY_CLASSES,
  PROVIDER_MODEL_VERSION,
  PROVIDER_RELATION_CLASSES,
  PROVIDER_SCHEMA_IDENTIFIERS,
  PROVIDER_STANDARD_NAME,
  ProviderElementSchema,
  ProviderModelSchema,
  ProviderRelationSchema,
  neutralEntityClassOf,
  neutralRelationClassOf,
  parseProviderModel,
} from './provider/payload';
export type {
  ProviderElement,
  ProviderModel,
  ProviderModelParse,
  ProviderRelation,
} from './provider/payload';
export {
  conflictingModel,
  danglingRelationModel,
  FIXTURE_INSTANT,
  FIXTURE_MODEL_NAME,
  incompleteModel,
  malformedModel,
  referenceModel,
} from './provider/fixtures';

// The deterministic projection (pure functions).
export {
  modelDigestOf,
  modelIdOf,
  observeModel,
  projectModel,
  sourceRefOf,
  verifyObservation,
  verifyProjection,
} from './projection';
export type { ProjectionInput } from './projection';

// The tenant-scoped idempotent ingestion host.
export { IfcAdapterHost } from './ingestion';
export type { IngestModelInput } from './ingestion';

// The W007 adapter surfaces.
export { IfcSemanticAdapter, IfcSourceAdapter } from './adapters';
export type {
  IfcSemanticAdapterOptions,
  IfcSourceAdapterOptions,
} from './adapters';

// W007 descriptor discipline (content-addressed, standard-neutral).
export {
  CAPABILITY_VERSION,
  IFC_ADAPTER_DESCRIPTORS,
  SEMANTIC_ADAPTER_DESCRIPTOR,
  SEMANTIC_ADAPTER_DESCRIPTOR_DIGEST,
  SOURCE_ADAPTER_DESCRIPTOR,
  SOURCE_ADAPTER_DESCRIPTOR_DIGEST,
} from './descriptor';

// W007 capability-registration derivation (the registration conventions).
export { deriveCapabilityRegistrations } from './registration';
export type {
  DerivedCapabilityManifest,
  DerivedCapabilityRegistration,
} from './registration';
