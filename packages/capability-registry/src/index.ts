/**
 * @epoch/capability-registry — public API (kernel layer, Work Order W007).
 *
 * The Capability Fabric registry (architecture.md, binding): registers
 * VERSIONED, CONTENT-ADDRESSED capability manifests across the eight
 * adapter categories (source, semantic, reconstruction, visualization,
 * simulation, evaluator, action, verification), governs the typed
 * lifecycle `registered -> deprecated -> retired`, and resolves
 * version-constrained lookups deterministically.
 *
 * - Provider-NEUTRAL by construction (lock rule 13): the category
 *   vocabulary is the agent-protocol Capability Fabric list; every other
 *   identifier is opaque; strict objects reject unknown (vendor) fields.
 * - The registry REGISTERS simulator/evaluator/verifier capabilities; it
 *   never implements them (lock rule 5) — no engine, no execution.
 * - Manifest integrity: registrations are sealed with the SHA-256 of the
 *   manifest's canonical JSON; the registry rejects digest mismatches
 *   (tamper detection).
 * - Reference in-memory registry: NO persistence, NO event log, NO UI,
 *   NO workflow engine (later Work Orders); records are plain
 *   serialization-friendly JSON.
 *
 * Versioned contract surface: version constants + typed index export (this
 * file), runtime zod validators (src/schema.ts), compile-time parity
 * (src/parity.ts), and the committed JSON Schema projection under schemas/
 * pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  CAPABILITY_LIFECYCLE_STATES,
  CAPABILITY_LIFECYCLE_TRANSITIONS,
  CAPABILITY_MANIFEST_VERSION,
  CAPABILITY_ORIGINS,
  CAPABILITY_REGISTRY_CONTRACT_VERSION,
} from './version';

// Published contract types.
export type {
  CapabilityCategory,
  CapabilityContractReference,
  CapabilityDescriptor,
  CapabilityId,
  CapabilityLifecycleState,
  CapabilityManifest,
  CapabilityOrigin,
  CapabilityRecord,
  CapabilityRegistration,
  CapabilityTrust,
  CapabilityVersion,
  RegistryError,
  RegistryErrorCode,
  RegistryIssue,
  RegistryResult,
} from './types';

// Runtime validators.
export {
  CapabilityCategorySchema,
  CapabilityContractReferenceSchema,
  CapabilityDescriptorSchema,
  CapabilityIdSchema,
  CapabilityLifecycleStateSchema,
  CapabilityManifestSchema,
  CapabilityManifestVersionSchema,
  CapabilityOriginSchema,
  CapabilityRecordSchema,
  CapabilityTrustSchema,
  SHA256_HEX_PATTERN,
  SemverCoreSchema,
  Sha256DigestSchema,
  VersionConstraintSchema,
} from './schema';

// Semantic-version machinery (self-contained; see src/semver.ts for the
// duplication + parity-test policy).
export {
  compareSemver,
  parseSemverCore,
  satisfiesVersionConstraint,
  type SemverParse,
  type SemverParts,
  type VersionConstraint,
} from './semver';

// Total parse surface.
export { parseCapabilityManifest, parseCapabilityRecord } from './parse';

// Digest discipline (canonical SHA-256 content addressing + tamper detection).
export {
  computeCapabilityManifestDigest,
  sealCapabilityManifest,
  verifyManifestDigest,
} from './digest';

// The reference in-memory registry.
export {
  CapabilityRegistry,
  type CapabilityLookup,
  type ListCapabilitiesFilter,
  type RegisterCapabilityInput,
  type ResolveCapabilityInput,
} from './registry';

// Compile-time contract parity (type-only).
export type {
  CapabilityRegistryLiteralSync,
  CapabilityRegistryResultSync,
  CapabilityRegistrySchemaSync,
} from './parity';

// Published schema surface + contract emission.
export { CAPABILITY_REGISTRY_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  CAPABILITY_REGISTRY_CONTRACT_DIR,
  renderCapabilityRegistryContractFiles,
  typeToKebabCase,
} from './contract-emission';
