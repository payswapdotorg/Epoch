/**
 * Version constants + closed vocabularies of the interactive-world runtime
 * (W057). The runtime is the HOST-SIDE layer between app surfaces and the
 * W056 Renderer Fabric: it adds NO new contract package — every durable
 * concept it touches lives in the frozen contracts (`contracts/renderers`
 * v1.1.0, `contracts/experience`, `contracts/world`) implemented by
 * `@epoch/renderer-runtime`, `@epoch/renderer-fabric`, and
 * `@epoch/world-experience`.
 */

/** The runtime's own surface version (not a contract version). */
export const WORLD_RUNTIME_VERSION = '1.0.0' as const;

/**
 * The closed vocabulary of VIEWPORT TOOLS the workspace exposes. A tool is
 * a neutral presentation affordance: it selects WHICH existing typed
 * intent a raw pointer-down normalizes toward (the intent hint the fabric
 * input envelope carries); it never introduces new intent semantics.
 */
export const WORLD_TOOLS = [
  'select',
  'inspect',
  'isolate',
  'measure',
  'annotate',
  'hide',
] as const;

/** One viewport tool id. */
export type WorldTool = (typeof WORLD_TOOLS)[number];

/** The sorted tool list (deterministic). */
export const WORLD_TOOL_LIST: readonly WorldTool[] = [...WORLD_TOOLS].sort();

/**
 * The neutral camera navigation kinds the workspace supports (orbit /
 * pan / zoom / free-fly). These are PRESENTATION-ONLY camera operations
 * (the renderer-fabric architecture keeps camera interpolation
 * presentation-only unless represented by existing Epoch contracts — the
 * portable camera state is that contract); semantic zoom goes through the
 * existing typed zoom intent instead.
 */
export const NAVIGATION_KINDS = ['orbit', 'pan', 'zoom', 'free-look'] as const;

/** One navigation gesture kind. */
export type NavigationKind = (typeof NAVIGATION_KINDS)[number];

/**
 * The closed set of desktop navigation keys the runtime recognizes
 * (game-like engineering UX: WASD pans the orbit anchor, Q/E orbits the
 * azimuth, R/F orbits the elevation, +/- zooms the orbit distance). Keys
 * are neutral tokens, never engine vocabulary.
 */
export const NAVIGATION_KEYS = [
  'w',
  'a',
  's',
  'd',
  'q',
  'e',
  'r',
  'f',
  '+',
  '-',
] as const;

/** One desktop navigation key token. */
export type NavigationKey = (typeof NAVIGATION_KEYS)[number];

/** The maximum journal entries the runtime retains (bounded memory). */
export const MAX_JOURNAL_ENTRIES = 256;

/** The maximum effect entries the runtime retains (bounded memory). */
export const MAX_EFFECT_ENTRIES = 128;

/**
 * The maximum imported foundation assets the runtime retains in its
 * digest-addressed registry (W067, ACR-010 — bounded memory; the registry
 * is in-memory EPHEMERAL experience state, never persisted).
 */
export const MAX_IMPORTED_ASSETS = 64;

/**
 * The maximum bound-asset ledger entries the runtime retains (W067,
 * ACR-010 — the digest-addressed evidence log of binding applications;
 * bounded like the journal, oldest-first trim).
 */
export const MAX_BOUND_ASSETS = 128;
