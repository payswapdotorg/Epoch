/**
 * @epoch/document-adapter — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality (architecture lock rule 13): documents are TYPED BYTES plus
 * descriptors. No field encodes a vendor document service, cloud API, key,
 * or client — concrete ingestion sources are future adapters. The typed
 * document forms are deterministic structured fixtures (`structured-text`,
 * `structured-json`); real-world format support is future adapter work
 * behind this seam.
 *
 * Derivation is a PURE PROJECTION over document bytes: no stage in this
 * package mutates kernel state (world-model assertions, registry records,
 * durable stores are never touched). Every stage emits a W006-shaped
 * evidence record chained to the document digest, and every identifier is
 * content-derived (SHA-256 over canonical content via @epoch/agent-protocol)
 * — identical (document bytes, descriptor, run context) derive identical
 * candidates and evidence, and the src contains zero wall-clock reads and
 * zero randomness (all timestamps arrive as typed host inputs).
 */
import type { JsonValue, QualifiedTypeReference, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type {
  CapabilityCategory,
  CapabilityContractReference,
  CapabilityOrigin,
} from '@epoch/capability-registry';
import type {
  DocumentFormat,
  ExtractionStageKind,
  TrustEscalationOp,
} from './version';

// Re-exported so the typed contract surface is complete at one import site.
export type { DocumentFormat, ExtractionStageKind, TrustEscalationOp };

/** Opaque tenant identity: `tenant:<slug>` (W009 grammar). */
export type TenantId = string;

/** Opaque workspace identity: `workspace:<slug>` (W009 grammar). */
export type WorkspaceId = string;

/** Opaque project identity: `project:<slug>` (W009 grammar). */
export type ProjectId = string;

/** Opaque document artifact identity: `doc:` + 64 lowercase hex. */
export type DocumentId = string;

/** Opaque candidate identity: `cand:` + 64 lowercase hex. */
export type CandidateId = string;

/** Opaque provisional-definition identity: `docmap:` + 64 lowercase hex. */
export type DefinitionId = string;

/**
 * Tenant scoping of a document, its candidates, and its evidence (R12):
 * the owning tenant plus optional workspace/project narrowing. Mirrors
 * the W011 experience-protocol `TenantScope` discipline with W009 id
 * grammars.
 */
export interface TenantScope {
  readonly tenantId: TenantId;
  readonly workspaceId?: WorkspaceId | undefined;
  readonly projectId?: ProjectId | undefined;
}

/**
 * The typed document bytes: exactly one content shape per supported
 * format. `structured-text` carries the raw UTF-8 text; `structured-json`
 * carries a JSON value (its canonical byte form is the agent-protocol
 * canonical JSON serialization).
 */
export type DocumentContent =
  | { readonly format: 'structured-text'; readonly text: string }
  | { readonly format: 'structured-json'; readonly json: JsonValue };

/**
 * The content-addressed, format-typed, tenant-scoped document descriptor.
 *
 * `digest` is the SHA-256 of the document's canonical bytes (see
 * `canonicalDocumentBytes`); `byteLength` is the UTF-8 byte length of
 * those canonical bytes. Both are recomputed and verified at admission —
 * a descriptor whose claims do not match the actual content is rejected
 * (`digest-mismatch` tamper detection).
 */
export interface DocumentDescriptor {
  readonly schemaVersion: 1;
  readonly tenantScope: TenantScope;
  /** SHA-256 (lowercase hex, 64 chars) of the document's canonical bytes. */
  readonly digest: Sha256Hex;
  /** The typed deterministic document form. */
  readonly format: DocumentFormat;
  /** UTF-8 byte length of the canonical bytes. */
  readonly byteLength: number;
}

/**
 * Who produced a stage's evidence, and when — ALL host-supplied typed
 * data. The derivation never reads the wall clock, so determinism is a
 * pure function of its typed inputs.
 */
export interface StageRunContext {
  /** Opaque id of the derivation run. */
  readonly runId: string;
  /** Opaque actor identity (agent, person, or system). */
  readonly actorId: string;
  /** Opaque id of the derivation method, when recorded. */
  readonly methodId?: string | undefined;
  /** When the stage was executed (canonical UTC instant, host-supplied). */
  readonly observedAt: Timestamp;
}

/** One parsed mapping row of the typed mapping-table document form. */
export interface ParsedMappingRow {
  /** Document field locator (W028 SOURCE_PATH grammar). */
  readonly sourcePath: string;
  /** W002 semantic type key (`namespace:name`). */
  readonly semanticTarget: string;
  /** Property-level mappings (may be empty for whole-field mappings). */
  readonly propertyMappings: readonly PropertyMapping[];
  /** Caller-declared confidence of the mapping, in [0, 1]. */
  readonly declaredConfidence?: number | undefined;
  /** Upstream capability this mapping adapts (optional, W007 reference). */
  readonly capabilityRef?: QualifiedTypeReference | undefined;
  /** 1-based line number (`structured-text` only; absent for JSON). */
  readonly line?: number | undefined;
}

/** One property-level mapping: document property -> semantic property. */
export interface PropertyMapping {
  readonly sourceProperty: string;
  readonly semanticProperty: string;
}

/** The normalized typed view of a parsed mapping-table document. */
export interface ParsedDocument {
  readonly schemaVersion: 1;
  readonly descriptor: DocumentDescriptor;
  /** The canonical byte form the digest addresses. */
  readonly canonicalBytes: string;
  /** The normalized mapping rows, in document order. */
  readonly rows: readonly ParsedMappingRow[];
}

/**
 * Where a candidate was found in the document: the format, the stable
 * source-path identifier, and (for the text form) the 1-based line.
 */
export type DocumentFieldLocator =
  | {
      readonly format: 'structured-text';
      readonly sourcePath: string;
      readonly line: number;
    }
  | {
      readonly format: 'structured-json';
      readonly sourcePath: string;
    };

/**
 * A typed mapping candidate derived deterministically from a
 * content-addressed document: which document field maps onto which W002
 * semantic type, with which property-level mappings. The candidate is a
 * PURE projection — its identity (`cand:<sha256>`) is the SHA-256 of its
 * canonical content, so identical (document bytes, descriptor) always
 * derive identical candidates in identical order.
 */
export interface ExtractionCandidate {
  readonly schemaVersion: 1;
  /** Content-derived identity: `cand:` + SHA-256 of canonical candidate content. */
  readonly candidateId: CandidateId;
  /** The content address of the exact document revision this came from. */
  readonly documentDigest: Sha256Hex;
  readonly tenantScope: TenantScope;
  readonly locator: DocumentFieldLocator;
  /** W002 semantic type key (`namespace:name`, `core` reserved). */
  readonly semanticTarget: string;
  readonly propertyMappings: readonly PropertyMapping[];
  readonly declaredConfidence?: number | undefined;
  readonly capabilityRef?: QualifiedTypeReference | undefined;
}

/** One link of the stage evidence chain. */
export interface StageEvidenceLink {
  readonly stage: ExtractionStageKind;
  /** Content address (W006 evidence digest) of the stage evidence record. */
  readonly evidenceDigest: Sha256Hex;
}

/**
 * The ordered stage evidence chain anchoring a derivation to its document:
 * `uploaded -> parsed -> candidates-extracted [-> review-pending [->
 * provisional]]` — always a prefix of the pipeline, no gaps, no repeats.
 * Every link is a W006 evidence record whose subject is the EXACT document
 * revision (digest) and whose payload names the stage; a chain whose
 * records are missing, tampered, unanchored, or out of order is BROKEN and
 * everything derived through it is rejected (`broken-evidence-chain`).
 */
export interface StageEvidenceChain {
  readonly schemaVersion: 1;
  readonly documentDigest: Sha256Hex;
  readonly tenantScope: TenantScope;
  readonly stages: readonly StageEvidenceLink[];
}

/**
 * The registration plan against the W007 source-category vocabulary.
 * A DERIVED plan always carries category `source` and origin
 * `provisional-document-derived` (the W007 vocabulary members the
 * document adapter emits); a plan naming any other member of the W007
 * vocabularies is admitted as typed data but rejected at build time as a
 * typed `policy-violation` (the floor is enforced, not assumed).
 */
export interface ProvisionalRegistrationPlan {
  /** Derived qualified capability id (`docmap.<namespace>.<name>`). */
  readonly capabilityId: string;
  /** W007 Capability Fabric category (derived plans: `source`). */
  readonly category: CapabilityCategory;
  /** Semver core; the first provisional registration ships 1.0.0. */
  readonly version: string;
  /** W007 origin vocabulary (derived plans: `provisional-document-derived`). */
  readonly origin: CapabilityOrigin;
  /** Versioned contracts the mapping honors. */
  readonly contracts: readonly CapabilityContractReference[];
  /** SHA-256 of the provisional-stage evidence record backing the admission. */
  readonly attestationDigest: Sha256Hex;
}

/**
 * The PROVISIONAL adapter definition: the typed mapping candidate with
 * FULL provenance — document digest -> complete five-stage evidence chain
 * -> candidate — plus its W007 registration plan. Lifecycle is terminal
 * at `provisional`: there is no field, code path, or transition that
 * leaves the provisional floor here; escalation attempts are the typed
 * rejection `trust-escalation-denied`.
 */
export interface ProvisionalAdapterDefinition {
  readonly schemaVersion: 1;
  /** Content-derived identity: `docmap:` + SHA-256 of canonical definition content. */
  readonly definitionId: DefinitionId;
  readonly tenantScope: TenantScope;
  /** The content address of the exact document revision. */
  readonly documentDigest: Sha256Hex;
  /** The embedded candidate (pure projection, content-addressed). */
  readonly candidate: ExtractionCandidate;
  /** The COMPLETE five-stage evidence chain (uploaded ... provisional). */
  readonly evidenceChain: StageEvidenceChain;
  readonly registration: ProvisionalRegistrationPlan;
  /** Terminal lifecycle state (constant by construction). */
  readonly lifecycle: 'provisional';
}

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface DocumentAdapterIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The typed error taxonomy (W028 Tech Lead pin). Every entry point is
 * total — errors are discriminated values, never thrown:
 * - `malformed-document` — schema/grammar violations with flattened issues
 *   (strict objects reject unknown — vendor/provider — fields);
 * - `unsupported-format` — a document form outside the closed vocabulary;
 * - `digest-mismatch` — claimed content address ≠ recomputed (tamper);
 * - `broken-evidence-chain` — missing/tampered/unanchored/out-of-order
 *   stage evidence, or a derivation not covered by its chain;
 * - `cross-tenant-denied` — a tenant boundary crossing (R12);
 * - `policy-violation` — an illegal lifecycle advance or a registration
 *   plan outside the W007 provisional vocabulary;
 * - `trust-escalation-denied` — certify/execute/grant-capability against
 *   a document-derived mapping (always denied; the floor, not the gate);
 * - `unknown-capability-reference` — a referenced capability that does not
 *   resolve in the registry.
 */
export type DocumentAdapterError =
  | {
      readonly code: 'malformed-document';
      readonly message: string;
      readonly issues: readonly DocumentAdapterIssue[];
    }
  | {
      readonly code: 'unsupported-format';
      readonly message: string;
      readonly format: string;
      readonly supportedFormats: readonly DocumentFormat[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'broken-evidence-chain';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly stage?: ExtractionStageKind | undefined;
      readonly reason:
        | 'missing-record'
        | 'invalid-record'
        | 'digest-mismatch'
        | 'unanchored-subject'
        | 'stage-mismatch'
        | 'kind-mismatch'
        | 'tenant-mismatch'
        | 'out-of-order'
        | 'incomplete-chain'
        | 'uncovered-candidate';
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | {
      readonly code: 'policy-violation';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly rule:
        | 'lifecycle-transition'
        | 'registration-category'
        | 'registration-origin'
        | 'registration-version'
        | 'manifest-shape';
    }
  | {
      readonly code: 'trust-escalation-denied';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly op: TrustEscalationOp;
      readonly currentTrustClass: string;
      readonly ceiling: string;
    }
  | {
      readonly code: 'unknown-capability-reference';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly capabilityId: string;
      readonly version?: string | undefined;
    };

/** Result of a total document-adapter entry point. */
export type DocumentAdapterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DocumentAdapterError };
