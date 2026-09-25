/**
 * @epoch/document-adapter — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry): a serialized
 * document-adapter document (descriptor, stage record, evidence chain,
 * candidate, provisional definition) is admitted only when its
 * `schemaVersion` equals {@link DOCUMENT_RECORD_VERSION} exactly; skew
 * surfaces as a `malformed-document` issue at path ["schemaVersion"]
 * before any other schema diagnostics. {@link
 * DOCUMENT_ADAPTER_CONTRACT_VERSION} versions the published contract
 * surface (schemas/ + the typed index export).
 *
 * Provider neutrality (architecture lock rule 13): documents are typed
 * bytes + descriptors. The format vocabulary names TYPED DETERMINISTIC
 * document forms (`structured-text`, `structured-json`) — real-world
 * format parsers (PDF, office documents, vendor cloud APIs) are future
 * W029-style adapter work behind this seam, never kernel vocabulary.
 * Zero vendor document services exist here.
 *
 * Trust tiers (spec/extension-architecture.md, binding): document-derived
 * extensions begin provisional and cannot certify or execute. This
 * package implements the FLOOR: the trust class is a fixed constant and
 * every escalation request is a typed rejection.
 */

/** Version of the published document-adapter contract surface (schemas/ + types). */
export const DOCUMENT_ADAPTER_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized document-adapter document. */
export const DOCUMENT_RECORD_VERSION = 1 as const;

/** The contract id this package issues for W007 contract references. */
export const DOCUMENT_ADAPTER_CONTRACT_ID = 'epoch.document-adapter' as const;

/**
 * The supported deterministic document forms (W028 pin: "deterministic
 * structured fixtures (e.g., typed text/JSON document forms) — NOT
 * heavyweight real-world parsers"). Each format defines exactly one
 * canonical byte form; real formats are future adapters behind this seam.
 */
export const DOCUMENT_FORMATS = ['structured-text', 'structured-json'] as const;

/** One supported deterministic document form. */
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];

/** Canonical media types of the document forms (RFC 6838-style, lowercase). */
export const DOCUMENT_FORMAT_MEDIA_TYPES: Readonly<Record<DocumentFormat, string>> = {
  'structured-text': 'text/plain',
  'structured-json': 'application/json',
};

/**
 * The derivation pipeline (architecture direction, binding):
 * Uploaded -> Parsed -> CandidatesExtracted -> ReviewPending -> Provisional.
 * The final stage is TERMINAL — a document-derived mapping never leaves the
 * provisional floor through this pipeline.
 */
export const EXTRACTION_STAGE_KINDS = [
  'uploaded',
  'parsed',
  'candidates-extracted',
  'review-pending',
  'provisional',
] as const;

/** One derivation stage. */
export type ExtractionStageKind = (typeof EXTRACTION_STAGE_KINDS)[number];

/**
 * The typed provisional lifecycle transition table: each stage advances to
 * exactly its successor, `provisional` is terminal, and there is no skip,
 * no branch, and no revival. An illegal advance is a policy violation of
 * the pipeline discipline (`policy-violation`), and every attempt to leave
 * the provisional floor (`certify`, `execute`, `grant-capability`) is the
 * typed rejection `trust-escalation-denied`.
 */
export const PROVISIONAL_LIFECYCLE_TRANSITIONS: Readonly<
  Record<ExtractionStageKind, readonly ExtractionStageKind[]>
> = {
  uploaded: ['parsed'],
  parsed: ['candidates-extracted'],
  'candidates-extracted': ['review-pending'],
  'review-pending': ['provisional'],
  provisional: [],
};

/**
 * The W006 evidence kind each stage emits (closed vocabulary from
 * @epoch/evidence EVIDENCE_KINDS): the document stages capture the
 * document itself, the extraction stage captures the deterministic
 * computation, and the review/provisional stages capture the assertions
 * that the review gate and the provisional admission represent.
 */
export const STAGE_EVIDENCE_KINDS: Readonly<Record<ExtractionStageKind, 'document' | 'computation' | 'assertion'>> = {
  uploaded: 'document',
  parsed: 'document',
  'candidates-extracted': 'computation',
  'review-pending': 'assertion',
  provisional: 'assertion',
};

/**
 * Trust-escalation operations that are ALWAYS denied for document-derived
 * mappings (extension-architecture.md: "Document-derived extensions begin
 * provisional and cannot certify or execute"; the capability-grant denial
 * is the same floor for host capability grants). This package implements
 * the floor, not the gate — the typed rejection is the entire behavior.
 */
export const TRUST_ESCALATION_OPS = ['certify', 'execute', 'grant-capability'] as const;

/** One always-denied trust-escalation operation. */
export type TrustEscalationOp = (typeof TRUST_ESCALATION_OPS)[number];

/**
 * The fixed trust class of every document-derived mapping: provisional
 * model population (T1). It is a CONSTANT — there is no code path that
 * computes, grants, or upgrades it.
 */
export const DOCUMENT_DERIVED_TRUST_CLASS = 't1' as const;

/** The trust ceiling a document-derived mapping can never exceed. */
export const PROVISIONAL_TRUST_CEILING = 't1' as const;

/**
 * Semantic type keys reference the W002 world-model namespace grammar
 * (`namespace:name`, lowercase segments, `core` reserved for the kernel
 * vocabulary). The grammar is IDENTICAL to the W002 `TypeKeySchema`
 * regex; the W002 core vocabularies are pinned member-for-member by the
 * devDependency parity test (test/kernel-parity.test.ts).
 */
export const SEMANTIC_TYPE_KEY_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

/**
 * Tenancy id grammars — identical to @epoch/tenancy (W009):
 * `tenant:<slug>`, `workspace:<slug>`, `project:<slug>`. Pinned by the
 * devDependency parity test.
 */
export const TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;
export const WORKSPACE_ID_PATTERN = /^workspace:[a-z0-9][a-z0-9-]{0,62}$/;
export const PROJECT_ID_PATTERN = /^project:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Document field locator (source path): the stable identifier of a field
 * inside a document form. Same grammar family as the W002 property names
 * (short stable identifiers).
 */
export const SOURCE_PATH_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/;

/** Document property name (source and semantic sides). */
export const PROPERTY_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/;

/** Opaque document artifact identity: `doc:` + 64 lowercase hex (content-derived). */
export const DOCUMENT_ID_PATTERN = /^doc:[0-9a-f]{64}$/;

/** Opaque candidate identity: `cand:` + 64 lowercase hex (content-derived). */
export const CANDIDATE_ID_PATTERN = /^cand:[0-9a-f]{64}$/;

/** Opaque provisional definition identity: `docmap:` + 64 lowercase hex. */
export const DEFINITION_ID_PATTERN = /^docmap:[0-9a-f]{64}$/;

/**
 * The provisional registration shape against the W007 vocabulary: every
 * document-derived mapping registers in the `source` category with origin
 * `provisional-document-derived` (CAPABILITY_ORIGINS). A registration
 * plan that names any other category or origin violates the policy and
 * is a typed `policy-violation`.
 */
export const PROVISIONAL_CAPABILITY_CATEGORY = 'source' as const;
export const PROVISIONAL_CAPABILITY_ORIGIN = 'provisional-document-derived' as const;

/** Version assigned to a first provisional registration of a mapping. */
export const PROVISIONAL_CAPABILITY_VERSION = '1.0.0' as const;

/** The typed error-code taxonomy (W028 Tech Lead pin). */
export const DOCUMENT_ADAPTER_ERROR_CODES = [
  'malformed-document',
  'unsupported-format',
  'digest-mismatch',
  'broken-evidence-chain',
  'cross-tenant-denied',
  'policy-violation',
  'trust-escalation-denied',
  'unknown-capability-reference',
] as const;

/** One typed error code (see src/errors.ts). */
export type DocumentAdapterErrorCode = (typeof DOCUMENT_ADAPTER_ERROR_CODES)[number];
