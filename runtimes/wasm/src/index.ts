/**
 * runtimes/wasm — public API (Wasm Component Model HOST-side machinery,
 * Work Order W008).
 *
 * Self-contained by design (Tech Lead pin): this directory is NON-
 * workspace machinery (same status as contracts/*), carries no
 * package.json, and its sources import NOTHING. Its canonical-JSON +
 * SHA-256 machinery is a deliberate mirror of @epoch/agent-protocol's,
 * pinned by parity evidence (NIST vectors + node:crypto cross-check +
 * canonical-JSON fixture corpus) in test/digest.parity.test.ts.
 *
 * Zero vendored toolchains, zero actual Wasm binaries, zero network:
 * section contents are verified over caller-provided bytes.
 *
 * Typecheck + tests run through @epoch/extension-runtime (tsconfig
 * include + vitest project — the contracts/* precedent of checking
 * non-package directories through the owning workspace package).
 */

// Versions + vocabularies.
export {
  QUALIFIED_NAME_PATTERN,
  SEMVER_CORE_PATTERN,
  SHA256_HEX_PATTERN,
  SLUG_PATTERN,
  WASM_INTERFACE_NAME_PATTERN,
  WASM_LAYOUT_CONTRACT_VERSION,
  WASM_LAYOUT_SCHEMA_VERSION,
  WASM_SECTION_KINDS,
  WASM_VALUE_TYPES,
} from './version';
export type {
  WasmLayoutErrorCode,
  WasmSectionKind,
  WasmValueType,
} from './version';

// Published types.
export type {
  ComponentFunctionDeclaration,
  ComponentInterfaceDeclaration,
  ComponentLayoutDescriptor,
  LayoutSection,
  SealedLayoutDescriptor,
  SectionContentBundle,
  WasmParamDeclaration,
} from './types';
export type { Sha256Hex } from './digest';

// Error taxonomy + result helpers.
export {
  CanonicalizationError,
  digestMismatch,
  fail,
  ok,
  validationError,
} from './errors';
export type {
  WasmLayoutError,
  WasmLayoutIssue,
  WasmLayoutResult,
} from './errors';

// Canonical JSON + digests (mirrored agent-protocol machinery).
export { canonicalJsonStringify, type JsonValue } from './canonical';
export { canonicalDigest, sha256BytesHex, sha256Hex } from './digest';

// Rule table (single source of truth: validation + schema emission).
export { WASM_LAYOUT_RULES, WASM_LAYOUT_TYPE_NAMES } from './rules';
export type { WasmFieldRule, WasmLayoutTypeName, WasmRule } from './rules';

// Structural validation machinery (precise-path, strict, total).
export {
  validateComponentLayoutDescriptor,
  validateWasmLayoutType,
} from './validate';

// Content addressing + section-content verification.
export {
  computeLayoutDigest,
  sealLayoutDescriptor,
  serializeLayoutDescriptor,
  verifyLayoutDescriptorDigest,
  verifySectionContent,
} from './layout';

// Deterministic JSON Schema emission of the committed contract files.
export {
  renderWasmLayoutContractFiles,
  typeToKebabCase,
  WASM_LAYOUT_CONTRACT_DIR,
} from './emit';
