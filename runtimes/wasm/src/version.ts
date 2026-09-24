/**
 * runtimes/wasm — contract versions and closed vocabularies.
 *
 * W008 scope discipline: this directory is NON-workspace machinery (same
 * status as contracts/* — NOT matched by the pnpm workspace globs, no
 * package.json). It is the Wasm Component Model HOST-SIDE type surface:
 * canonical component layout rules (typed descriptor, digests, sizes,
 * deterministic ordering), typed import/export surface declarations, and
 * validation machinery (structural checks + digest verification).
 * ZERO vendored toolchains, ZERO actual Wasm binaries, ZERO network.
 *
 * Self-contained by design (Tech Lead pin): the source imports NOTHING
 * — not zod, not @epoch/agent-protocol. The canonical-JSON + SHA-256
 * machinery in src/canonical.ts and src/digest.ts is a DELIBERATE
 * MIRROR of @epoch/agent-protocol's implementation (the "reuse or
 * mirror" option, mirror chosen to preserve self-containment), pinned
 * by parity evidence in test/digest.parity.test.ts: NIST test vectors,
 * a node:crypto cross-check, and a canonical-JSON fixture corpus.
 */

/** Version of the published wasm-layout contract surface (schemas/ + types). */
export const WASM_LAYOUT_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized component layout descriptor. */
export const WASM_LAYOUT_SCHEMA_VERSION = 1 as const;

/**
 * Canonical section kinds: a component package carries core modules,
 * adapter shims, and custom sections. Same vocabulary the author-side
 * WasmComponentDescriptor declares (pinned by the shared committed
 * fixture under test/fixtures/).
 */
export const WASM_SECTION_KINDS = ['adapter', 'core-module', 'custom'] as const;

/** One canonical section kind. */
export type WasmSectionKind = (typeof WASM_SECTION_KINDS)[number];

/**
 * WIT primitive value types admitted by the v1 surface (numeric
 * primitives, bool, char, string). Composite types (list, record,
 * variant) are future surface — recorded as a limitation.
 */
export const WASM_VALUE_TYPES = [
  'bool',
  'char',
  'f32',
  'f64',
  's16',
  's32',
  's64',
  's8',
  'string',
  'u16',
  'u32',
  'u64',
  'u8',
] as const;

/** One WIT primitive value type. */
export type WasmValueType = (typeof WASM_VALUE_TYPES)[number];

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Dot-namespaced qualified name (component identity). */
export const QUALIFIED_NAME_PATTERN = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

/** Semantic-version core (digits only). */
export const SEMVER_CORE_PATTERN = /^\d+\.\d+\.\d+$/;

/** Kebab slug (worlds, sections, functions, parameters). */
export const SLUG_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/** WIT-style interface name: kebab, optionally `namespace:kebab`. */
export const WASM_INTERFACE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,62}(:[a-z][a-z0-9-]{0,62}(\/[a-z][a-z0-9-]{0,62})?)?$/;

/** Error codes of the wasm-layout validation machinery (shared W008 taxonomy subset). */
export type WasmLayoutErrorCode = 'validation' | 'digest-mismatch';
