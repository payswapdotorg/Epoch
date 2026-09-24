/**
 * @epoch/capability-registry — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality (architecture lock rule 13): every identifier is opaque and
 * provider-neutral; the category vocabulary is the Capability Fabric
 * adapter-category list owned by @epoch/agent-protocol
 * (CAPABILITY_FABRIC_CATEGORIES — one source of truth, imported); the
 * origin vocabulary names provenance classes, never vendors or products.
 * No field encodes a provider, model, engine, or API surface.
 */
import type { ParameterSpec, Sha256Hex } from '@epoch/agent-protocol';
import type { CAPABILITY_FABRIC_CATEGORIES } from '@epoch/agent-protocol';
import type { CAPABILITY_LIFECYCLE_STATES, CAPABILITY_ORIGINS } from './version';
import type { VersionConstraint } from './semver';

/**
 * A Capability Fabric adapter category (architecture.md, "Capability
 * Fabric"): source, semantic, reconstruction, visualization, simulation,
 * evaluator, action, verification. A category names a role in the fabric,
 * never a vendor product. Shared vocabulary: imported from
 * @epoch/agent-protocol so the tool/agent declaration surface and the
 * registry cannot drift.
 */
export type CapabilityCategory = (typeof CAPABILITY_FABRIC_CATEGORIES)[number];

/** Lifecycle state of a registered capability (see src/version.ts). */
export type CapabilityLifecycleState = (typeof CAPABILITY_LIFECYCLE_STATES)[number];

/** Where a registered capability originates (see src/version.ts). */
export type CapabilityOrigin = (typeof CAPABILITY_ORIGINS)[number];

/**
 * Opaque, stable capability identity: a dot-namespaced qualified name
 * (e.g. `engineering.stress-analysis`) admitted by the agent-protocol
 * QUALIFIED_NAME_PATTERN. The identity is the scoping unit later
 * extensions bind to (architecture lock rule 9): it is opaque and stable
 * across versions — versions evolve, the id never does.
 */
export type CapabilityId = string;

/** The capability's semantic version (semver core, R18). */
export type CapabilityVersion = string;

/**
 * Reference to a versioned contract a capability honors — e.g. a
 * simulation-category capability referencing the simulation-protocol
 * contract (`epoch.simulation-protocol` at `1.0.0`), or a future
 * source-category capability referencing a W011+ source contract. The
 * referenced contract ids are owned by their issuing packages; the
 * registry stores and exposes them, it never interprets them.
 */
export interface CapabilityContractReference {
  /** Dot-namespaced qualified name identifying the referenced contract. */
  readonly contractId: string;
  /** Semver core of the referenced contract. */
  readonly contractVersion: string;
}

/**
 * The trust metadata surface (W007 work order): a typed, provider-neutral
 * record of where a capability comes from and what vouches for it. The
 * registry owns the SURFACE only — trust scoring, listings, and
 * entitlements are Marketplace concerns (W023), never registry semantics.
 */
export interface CapabilityTrust {
  /** Origin class (first-party, community, external software, provisional document-derived). */
  readonly origin: CapabilityOrigin;
  /** Opaque curator identity vouching for the registration (optional). */
  readonly curator?: string | undefined;
  /** Optional SHA-256 digest of evidence backing the registration. */
  readonly attestationDigest?: Sha256Hex | undefined;
}

/**
 * The provider-neutral capability descriptor: what the capability
 * consumes, produces, and assumes. Parameter specs are the shared
 * agent-protocol `ParameterSpec` shape (the same shape the agent
 * capability declarations and the W005 simulator/evaluator registrations
 * embed), so descriptors compose with the rest of the fabric without
 * new vocabulary.
 */
export interface CapabilityDescriptor {
  readonly displayName: string;
  readonly description?: string | undefined;
  readonly inputs: readonly ParameterSpec[];
  readonly outputs: readonly ParameterSpec[];
  /** Stated assumptions; the W005 registration discipline (no silent assumptions). */
  readonly assumptions: readonly string[];
}

/**
 * A capability manifest: the immutable, content-addressed registration
 * document. Identity is (capabilityId, version); content is the
 * descriptor, the honored contracts, and the trust surface. The manifest
 * carries NO lifecycle field by design — lifecycle is registry state
 * (transitions never rewrite history), and the digested document stays
 * byte-stable for the lifetime of the registration
 * (`computeCapabilityManifestDigest`). The published record surface is
 * {@link CapabilityRecord} = manifest + lifecycle + digest.
 */
export interface CapabilityManifest {
  readonly schemaVersion: 1;
  /** Opaque, stable capability identity (never changes across versions). */
  readonly capabilityId: CapabilityId;
  readonly category: CapabilityCategory;
  /** Semantic version of THIS capability revision (semver core). */
  readonly version: CapabilityVersion;
  readonly descriptor: CapabilityDescriptor;
  /** Versioned contracts the capability honors (may be empty while a category's contract is not yet frozen). */
  readonly contracts: readonly CapabilityContractReference[];
  readonly trust: CapabilityTrust;
}

/**
 * The registry's published record: the immutable manifest, its lifecycle
 * state, and the SHA-256 digest of the manifest's canonical JSON (the
 * exact-revision address of the registration). Serialization-friendly by
 * construction: a plain JSON object, the shape a future persistence Work
 * Order stores and replays.
 */
export interface CapabilityRecord {
  readonly schemaVersion: 1;
  readonly manifest: CapabilityManifest;
  readonly lifecycle: CapabilityLifecycleState;
  /** SHA-256 of the manifest's canonical JSON — the registration's content address. */
  readonly manifestDigest: Sha256Hex;
}

/**
 * A registration envelope: the manifest plus the digest CLAIMED for its
 * content. The registry recomputes the digest and rejects a mismatch
 * (`digest-mismatch` — tamper detection): a manifest whose digest does
 * not match its content never enters the registry.
 */
export interface CapabilityRegistration {
  readonly manifest: CapabilityManifest;
  readonly digest: Sha256Hex;
}

/** Issue codes reported by the registry's total entry points. */
export type RegistryErrorCode =
  | 'validation'
  | 'unknown-capability'
  | 'duplicate-capability'
  | 'version-unsatisfied'
  | 'lifecycle-conflict'
  | 'digest-mismatch';

/** One flattened validation issue (dotted path + message). */
export interface RegistryIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The typed registry error taxonomy (W007 Tech Lead pin; mirrors the
 * issue-code style of the W006 chain validator). Every entry point is
 * total — errors are values, not exceptions.
 */
export type RegistryError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly RegistryIssue[];
    }
  | {
      readonly code: 'unknown-capability';
      readonly message: string;
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'duplicate-capability';
      readonly message: string;
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'version-unsatisfied';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly constraint: VersionConstraint;
      readonly availableVersions: readonly string[];
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly from: CapabilityLifecycleState;
      readonly to: CapabilityLifecycleState;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    };

/** Result of a registry operation: a value or a typed error. */
export type RegistryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RegistryError };
