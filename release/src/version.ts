/**
 * @epoch/release-kit — versions and closed vocabularies (Work Order W035).
 *
 * The RELEASE READINESS DISCIPLINE (Tech Lead design pin, frozen): release
 * readiness, SDK documentation sync and marketplace readiness are DATA —
 * typed, versioned, evidence-grade records a release candidate carries
 * through a deterministic pipeline:
 *
 *   SCOPE (what ships + the battery + the benchmark citations + the SDK
 *     surface pins + the marketplace readiness subject)
 *     -> deriveReleaseChecklist (deterministic derivation: one typed item
 *        per check, in fixed vocabulary order)
 *     -> completeChecklistItem (typed evidence + caller-supplied instant
 *        + actor; zero wall-clock, zero randomness, zero I/O)
 *     -> evaluateReleaseReadiness (ready iff every item carries admissible
 *        evidence; blocked items are typed values, never exceptions)
 *     -> sealReleaseManifest (only sealable when READY; content-addressed)
 *     -> release:readiness events (append-only, over the W010 event
 *        shapes) whose deterministic fold REPLAYS the readiness state.
 *
 * Upstream authorities are CONSUMED, never redefined: the battery mirrors
 * the W033 deploy-model gate grammar, the benchmark citations mirror the
 * W034 performance budget-verdict vocabulary, the marketplace checks
 * reference the W023 kernel's public verifiers, and the SDK surface pins
 * reference the W007/W008/W023 contract versions. Compatibility is pinned
 * WITHOUT runtime dependencies (parity tests import the real packages).
 *
 * Vocabulary policy: every list below is a CLOSED vocabulary. Records
 * carrying values outside them are rejected at admission with a typed
 * `validation` issue — provider semantics never enter through an enum
 * door (architecture lock rule 13: no vendor, brand, marketplace ERP, PM
 * tool or payment processor appears anywhere in this tree).
 */

/** Version of the release-kit contract surface (types + this file). */
export const RELEASE_KIT_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized release record. */
export const RELEASE_KIT_RECORD_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// Readiness domains (the W035 objective, as a closed vocabulary).
// --------------------------------------------------------------------------------

/**
 * The readiness domains of a release candidate — exactly the three the
 * Work Order names: the RELEASE process itself, the SDK DOCUMENTATION
 * surface, and MARKETPLACE readiness. Derivation iterates this order.
 */
export const READINESS_DOMAINS = ['release', 'sdk-docs', 'marketplace'] as const;
export type ReadinessDomain = (typeof READINESS_DOMAINS)[number];

// --------------------------------------------------------------------------------
// Check kinds (one closed vocabulary across all three domains).
// --------------------------------------------------------------------------------

/**
 * The closed check-kind vocabulary:
 *
 * - release domain:
 *   - `battery-command-green` — one item per verification-battery command;
 *   - `benchmark-budget-within` — one item per cited W034 budget record;
 *   - `notes-published` — the release notes record is sealed + verified.
 * - sdk-docs domain:
 *   - `sdk-contract-synced` — one item per SDK surface: the documentation
 *     cites the surface's exact published contract version;
 *   - `sdk-examples-green` — the examples/sdk suite ran green.
 * - marketplace domain (the W023 readiness criteria):
 *   - `listing-chain-verified` — the published listing version chain
 *     verifies (immutable, hash-chained);
 *   - `entitlement-flip-verified` — grant -> entitled, revoke -> denied
 *     IMMEDIATELY (payment state is never authority);
 *   - `usage-fold-verified` — usage accounting folds deterministically
 *     with exact decimal totals;
 *   - `revenue-provenance-complete` — every revenue record carries full
 *     provenance back to its generating record.
 */
export const RELEASE_CHECK_KINDS = [
  'battery-command-green',
  'benchmark-budget-within',
  'notes-published',
  'sdk-contract-synced',
  'sdk-examples-green',
  'listing-chain-verified',
  'entitlement-flip-verified',
  'usage-fold-verified',
  'revenue-provenance-complete',
] as const;
export type ReleaseCheckKind = (typeof RELEASE_CHECK_KINDS)[number];

/**
 * The deterministic domain -> check-kind table (fixed order; the
 * checklist derivation is a pure function of the scope over this table).
 */
export const DOMAIN_CHECK_TABLE: readonly {
  readonly domain: ReadinessDomain;
  readonly checkKind: ReleaseCheckKind;
}[] = [
  { domain: 'release', checkKind: 'battery-command-green' },
  { domain: 'release', checkKind: 'benchmark-budget-within' },
  { domain: 'release', checkKind: 'notes-published' },
  { domain: 'sdk-docs', checkKind: 'sdk-contract-synced' },
  { domain: 'sdk-docs', checkKind: 'sdk-examples-green' },
  { domain: 'marketplace', checkKind: 'listing-chain-verified' },
  { domain: 'marketplace', checkKind: 'entitlement-flip-verified' },
  { domain: 'marketplace', checkKind: 'usage-fold-verified' },
  { domain: 'marketplace', checkKind: 'revenue-provenance-complete' },
] as const;

/** The SDK documentation surfaces (the docs/sdk tree documents each). */
export const SDK_SURFACE_IDS = ['adapter-sdk', 'capability-registry', 'extension-sdk', 'marketplace'] as const;
export type SdkSurfaceId = (typeof SDK_SURFACE_IDS)[number];

// --------------------------------------------------------------------------------
// Readiness verdicts.
// --------------------------------------------------------------------------------

/**
 * The closed readiness-verdict vocabulary: `ready` (every checklist item
 * carries admissible evidence) or `blocked` (at least one open item —
 * the blocked items are typed values with precise subjects).
 */
export const READINESS_VERDICTS = ['ready', 'blocked'] as const;
export type ReadinessVerdict = (typeof READINESS_VERDICTS)[number];

// --------------------------------------------------------------------------------
// Mirrored upstream vocabularies (parity-pinned by test, never redefined).
// --------------------------------------------------------------------------------

/**
 * The budget-outcome vocabulary — MIRRORED from @epoch/performance's
 * BUDGET_VERDICTS (W034). A benchmark citation may carry `within-budget`
 * or `near-budget` as admissible evidence; `over-budget` is a typed
 * evidence rejection (the W034 regression gate would bite first — see
 * docs/performance/gate-policy.md).
 */
export const BUDGET_OUTCOMES = ['within-budget', 'near-budget', 'over-budget'] as const;
export type BudgetOutcome = (typeof BUDGET_OUTCOMES)[number];

/**
 * The release component kinds — MIRRORED from @epoch/deploy-model's
 * COMPONENT_KINDS (W033): the deployable repository surface shapes a
 * release component record may reference. Repository roles, never
 * runtime vendors.
 */
export const RELEASE_COMPONENT_KINDS = ['package', 'service', 'app', 'adapter', 'pack'] as const;
export type ReleaseComponentKind = (typeof RELEASE_COMPONENT_KINDS)[number];

/**
 * The workload input units a benchmark citation may scale along —
 * MIRRORED from @epoch/performance's INPUT_UNITS (W034).
 */
export const BENCHMARK_INPUT_UNITS = ['planLines', 'observations', 'packProjections', 'scenarioSteps'] as const;
export type BenchmarkInputUnit = (typeof BENCHMARK_INPUT_UNITS)[number];

// --------------------------------------------------------------------------------
// Id grammars.
// --------------------------------------------------------------------------------

/** Release-candidate identity: `release:<slug>`. */
export const RELEASE_ID_PATTERN = /^release:[a-z0-9][a-z0-9-]{0,62}$/;

/** Release-notes identity: `notes:<slug>`. */
export const NOTES_ID_PATTERN = /^notes:[a-z0-9][a-z0-9-]{0,62}$/;

/** Readiness-checklist identity: `rc:<slug>` (a release candidate's checklist). */
export const CHECKLIST_ID_PATTERN = /^rc:[a-z0-9][a-z0-9-]{0,62}$/;

/** Checklist item identity: `item:<1-based index>:<slug>` (the W033 ops grammar). */
export const CHECKLIST_ITEM_ID_PATTERN = /^item:[1-9][0-9]*:[a-z0-9-]+$/;

/** Manifest identity: `manifest:<16 hex>` (derived from the content digest). */
export const MANIFEST_ID_PATTERN = /^manifest:[0-9a-f]{16}$/;

/** Acting actor identity: `actor:<slug>` (the W033 provenance grammar). */
export const RELEASE_ACTOR_PATTERN = /^actor:[a-z0-9][a-z0-9-]{0,62}$/;

/** Exact source revision: a 40-hex git SHA (caller-supplied, never read). */
export const REVISION_PATTERN = /^[0-9a-f]{40}$/;

/** The repository surface prefixes of the five deployable component kinds. */
export const COMPONENT_SURFACE_PREFIXES = {
  package: 'packages/',
  service: 'services/',
  app: 'apps/',
  adapter: 'adapters/',
  pack: 'packs/',
} as const;

// --------------------------------------------------------------------------------
// Release event vocabulary (append-only, over the W010 event shapes).
// --------------------------------------------------------------------------------

/**
 * The release event payload discriminator: `release:readiness` (the
 * `namespace:name` grammar of @epoch/event-log's
 * EVENT_KIND_DISCRIMINATOR_PATTERN — `release` is this tree's namespace).
 */
export const RELEASE_EVENT_DISCRIMINATOR = 'release:readiness' as const;

/**
 * The release event kinds (the payload-family data discriminators):
 * checklist-derived -> item-completed* -> readiness-evaluated ->
 * release-published. The fold replays them in sequence order.
 */
export const RELEASE_EVENT_KINDS = [
  'checklist-derived',
  'item-completed',
  'readiness-evaluated',
  'release-published',
] as const;
export type ReleaseEventKind = (typeof RELEASE_EVENT_KINDS)[number];

/**
 * Version discriminator carried by every serialized release event —
 * MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION (W010): the
 * release event stream is append-only typed events over the W010 event
 * shapes. The runtime parity test asserts the constants are equal; a
 * future W010 bump intentionally breaks that parity and surfaces here as
 * a review gate.
 */
export const RELEASE_EVENT_RECORD_VERSION = 1 as const;

/**
 * Release event stream identity — MIRRORED from @epoch/event-log's
 * EVENT_STREAM_ID_PATTERN (W010 grammar): `stream:<slug>`. One release
 * candidate's readiness journal is ONE stream; pinned by the runtime
 * parity test.
 */
export const RELEASE_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

// --------------------------------------------------------------------------------
// Error vocabulary.
// --------------------------------------------------------------------------------

/**
 * The typed release-kit error vocabulary. Every admission/completion/
 * sealing failure is one of these CODES carried as a value — the
 * negative paths are part of the contract, never exceptions.
 */
export const RELEASE_ERROR_CODES = [
  'validation',
  'digest-mismatch',
  'unknown-item',
  'item-already-complete',
  'evidence-rejected',
  'release-not-ready',
  'domain-missing',
] as const;
export type ReleaseErrorCode = (typeof RELEASE_ERROR_CODES)[number];
