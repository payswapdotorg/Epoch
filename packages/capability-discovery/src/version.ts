/**
 * @epoch/capability-discovery — versions, id grammars and closed
 * vocabularies (W045 / ACR-004).
 *
 * Every vocabulary below is provider-neutral by construction (architecture
 * lock rule 13): signal kinds, representation kinds, lifecycle states and
 * metric names describe ROLES in the discovery plane, never vendors,
 * models, products or APIs. The neutrality test battery pins this with a
 * provider blocklist over the whole src tree.
 */

/** Version of the published capability-discovery contract surface. */
export const CAPABILITY_DISCOVERY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator on serialized discovery records (v1). */
export const CAPABILITY_DISCOVERY_RECORD_VERSION = 1 as const;

/** Version of the universal demand compiler + role synthesizer. */
export const DISCOVERY_COMPILER_VERSION = '1.0.0' as const;

// ---------------------------------------------------------------------------
// Identifier grammars (self-contained; pattern-mirror the W003/W009/W020
// conventions — kernel-to-kernel grammar parity is pinned by tests, never
// by runtime coupling).
// ---------------------------------------------------------------------------

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Tenant identifier: `tenant:` + lowercase slug (mirrors the W009 grammar). */
export const DISCOVERY_TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/** UTC instant in the canonical wire form `YYYY-MM-DDTHH:MM:SS.mmmZ`. */
export const DISCOVERY_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Dot-namespaced qualified operation name (mirrors the W003 grammar). */
export const QUALIFIED_OPERATION_PATTERN = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

/** Content-addressed discovery run id: `discrun:` + 16 hex chars. */
export const DISCOVERY_RUN_ID_PATTERN = /^discrun:[0-9a-f]{16}$/;

/** Content-addressed capability demand id: `demand:` + 16 hex chars. */
export const DEMAND_ID_PATTERN = /^demand:[0-9a-f]{16}$/;

/** Content-addressed role proposal id: `drole:` + 16 hex chars. */
export const ROLE_PROPOSAL_ID_PATTERN = /^drole:[0-9a-f]{16}$/;

/** Candidate id: `cand:` + lowercase slug (stable per candidate). */
export const CANDIDATE_ID_PATTERN = /^cand:[a-z0-9][a-z0-9-]{0,62}$/;

/** Content-addressed capability gap id: `gap:` + 16 hex chars. */
export const GAP_ID_PATTERN = /^gap:[0-9a-f]{16}$/;

/** Content-addressed organization proposal id: `org:` + 16 hex chars. */
export const ORGANIZATION_ID_PATTERN = /^org:[0-9a-f]{16}$/;

/** Content-addressed ecosystem proposal id: `ecoprop:` + 16 hex chars. */
export const ECOSYSTEM_PROPOSAL_ID_PATTERN = /^ecoprop:[0-9a-f]{16}$/;

/** Content-addressed promotion record id: `promo:` + 16 hex chars. */
export const PROMOTION_ID_PATTERN = /^promo:[0-9a-f]{16}$/;

/**
 * Opaque signal/identifier slug (the Epoch `kind:id` colon convention is
 * admitted: `world:site-survey`, `principal:lead`, `policy:v1`).
 */
export const DISCOVERY_SLUG_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

// ---------------------------------------------------------------------------
// Closed vocabularies.
// ---------------------------------------------------------------------------

/**
 * The eleven universal lifecycle stages (USL1.0, binding). Discovery
 * records carry the stage as typed data; the vocabulary is owned by the
 * universal solution lifecycle, mirrored here as a closed union.
 */
export const UNIVERSAL_LIFECYCLE_STAGES = [
  'understand',
  'decide',
  'plan',
  'acquire',
  'realize',
  'observe',
  'actualize',
  'verify',
  'forecast',
  'close',
  'learn',
] as const;

/**
 * Universal task/problem signal kinds (ARCD1.0 "Detect decision or
 * delivery gaps from constraints, evidence, failed attempts, unresolved
 * unknowns, verification requirements, work packages and outcomes").
 * The demand compiler maps each kind onto demand facets with universal
 * rules — the mapping never names a provider.
 */
export const TASK_SIGNAL_KINDS = [
  'operation', // a required operation or outcome
  'decision', // an unresolved decision to be made
  'verification', // a verification/evidence requirement
  'artifact', // an artifact that must be produced
  'quality', // a quality/fidelity target
  'unknown', // an unresolved unknown
  'failure', // evidence of a failed attempt (capability gap signal)
  'work', // a work package to be executed
  'budget', // a latency/cost budget
  'environment', // an environment/tool requirement
  'authority', // a safety/authority constraint
  'dependency', // a dependency on another capability
  'outcome', // an outcome requirement
] as const;

/**
 * Neutral representation/modalities kinds (the compatibility vocabulary
 * shared by demand input/output contracts and candidate capability
 * claims). Kinds name data shapes, never products.
 */
export const REPRESENTATION_KINDS = [
  'text',
  'numeric',
  'tabular',
  'geometry',
  'image',
  'signal',
  'document',
  'structured',
  'code',
] as const;

/**
 * Capability-gap lifecycle states (ARCD1.0). Gap transitions are
 * append-only, hash-linked and content-addressed.
 */
export const CAPABILITY_GAP_STATES = [
  'UNSATISFIED',
  'CANDIDATE_FOUND',
  'EVALUATED',
  'VERIFIED',
  'DEGRADED',
  'REQUIRES_HUMAN',
] as const;

/** The legal gap-state transitions (append-only lifecycle). */
export const CAPABILITY_GAP_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  UNSATISFIED: ['CANDIDATE_FOUND', 'REQUIRES_HUMAN'],
  CANDIDATE_FOUND: ['EVALUATED', 'REQUIRES_HUMAN', 'UNSATISFIED'],
  EVALUATED: ['VERIFIED', 'DEGRADED', 'REQUIRES_HUMAN', 'UNSATISFIED'],
  VERIFIED: ['DEGRADED', 'UNSATISFIED'],
  DEGRADED: ['VERIFIED', 'REQUIRES_HUMAN', 'UNSATISFIED'],
  REQUIRES_HUMAN: ['CANDIDATE_FOUND', 'UNSATISFIED'],
};

/** Candidate natures resolvable against role demands (ARCD1.0). */
export const CANDIDATE_KINDS = ['agent', 'human', 'capability', 'external'] as const;

/**
 * Candidate evaluation lifecycle (CC1.0 contribution stages). External
 * candidates enter at `discovered` and are NON-CONSEQUENTIAL until the
 * sandbox/profile/evaluation/policy gates promote them to `verified`.
 */
export const CANDIDATE_EVALUATION_STATES = [
  'discovered',
  'ingested',
  'sandboxed',
  'profiled',
  'evaluated',
  'verified',
  'deprecated',
  'retired',
] as const;

/** The legal candidate-state promotions (the promotion gate). */
export const CANDIDATE_PROMOTION_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  discovered: ['ingested'],
  ingested: ['sandboxed', 'deprecated'],
  sandboxed: ['profiled', 'deprecated'],
  profiled: ['evaluated', 'deprecated'],
  evaluated: ['verified', 'deprecated'],
  verified: ['deprecated'],
  deprecated: ['retired'],
  retired: [],
};

/** Basis of a capability claim attached to a candidate. */
export const CLAIM_BASES = ['measured', 'declared'] as const;

/** Declared evaluation criterion kinds. */
export const EVALUATION_CRITERION_KINDS = [
  'hard-constraint',
  'objective',
  'evidence-coverage',
] as const;

/**
 * The deterministic organization-evaluation metrics (objective/constraint/
 * evidence criteria bind onto these neutral metrics).
 */
export const EVALUATION_METRICS = [
  'demand-coverage',
  'unmet-demand-count',
  'evidence-coverage',
  'redundancy-coverage',
  'estimated-latency',
  'estimated-cost',
  'gap-count',
  'critical-single-point-count',
] as const;

/** Discovery run kinds (the two ARCD1.0 streams). */
export const DISCOVERY_RUN_KINDS = ['problem-driven', 'ecosystem'] as const;

/** What triggered a discovery run. */
export const DISCOVERY_TRIGGERS = ['manual', 'gap', 'scheduled', 'event'] as const;

/** Lineage stage names (per run kind; the digest chain vocabulary). */
export const DISCOVERY_STAGE_NAMES = [
  'inputs',
  'demands',
  'roles',
  'resolution',
  'organizations',
  'evaluation',
  'selection',
  'candidates',
  'gap-updates',
  'promotions',
] as const;

/** The problem-driven lineage chain (binding order). */
export const PROBLEM_DRIVEN_STAGE_CHAIN = [
  'inputs',
  'demands',
  'roles',
  'resolution',
  'organizations',
  'evaluation',
  'selection',
] as const;

/** The ecosystem lineage chain (binding order). */
export const ECOSYSTEM_STAGE_CHAIN = [
  'inputs',
  'candidates',
  'gap-updates',
  'promotions',
] as const;

/** Ecosystem proposal kinds (R41: propose adapters/extensions/domain packs). */
export const ECOSYSTEM_PROPOSAL_KINDS = ['adapter', 'extension', 'domain-pack'] as const;

/** Ecosystem proposal review lifecycle. */
export const ECOSYSTEM_PROPOSAL_STATUSES = [
  'proposed',
  'under-review',
  'accepted',
  'rejected',
] as const;

/** Discovery source classes (provider-neutral). */
export const DISCOVERY_SOURCE_KINDS = [
  'public-catalog',
  'private-catalog',
  'internal',
  'fixture',
] as const;

/** Scheduler cadence kinds. */
export const DISCOVERY_CADENCE_KINDS = ['weekly', 'interval', 'event'] as const;

/** Default ecosystem-discovery cadence: weekly (ARCD1.0 recommendation). */
export const DEFAULT_DISCOVERY_CADENCE_DAYS = 7;

/** Milliseconds in one day (pure constant; scheduler math is deterministic). */
export const DAY_MS = 86_400_000;
