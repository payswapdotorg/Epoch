/**
 * The layout RULE TABLE — the single source of truth driving BOTH the
 * structural validator (src/validate.ts) and the committed JSON Schema
 * emission (src/emit.ts): one rule tree, two deterministic projections
 * (runtime validation machinery and the machine-checkable contract
 * files under schemas/, pinned byte-identical by
 * test/schema-drift.test.ts).
 *
 * Rule semantics (validation): strict objects reject unknown keys;
 * optional fields may be absent; arrays enforce minItems; patterns and
 * enums are checked exactly; integers are Number.isInteger and >=
 * minimum. Semantic ordering rules (sorted + duplicate-free arrays) are
 * layered on top by src/validate.ts (the JSON Schema projection is
 * structural-only — same fidelity note as the W007 contract manifests).
 */
import {
  QUALIFIED_NAME_PATTERN,
  SEMVER_CORE_PATTERN,
  SHA256_HEX_PATTERN,
  SLUG_PATTERN,
  WASM_INTERFACE_NAME_PATTERN,
  WASM_LAYOUT_SCHEMA_VERSION,
  WASM_SECTION_KINDS,
  WASM_VALUE_TYPES,
} from './version';

/** One rule of the layout surface. */
export type WasmRule =
  | { readonly kind: 'literal'; readonly value: string | number; readonly title: string; readonly description: string }
  | { readonly kind: 'pattern'; readonly pattern: RegExp; readonly title: string; readonly description: string }
  | { readonly kind: 'enum'; readonly values: readonly string[]; readonly title: string; readonly description: string }
  | { readonly kind: 'integer'; readonly minimum: number; readonly title: string; readonly description: string }
  | {
      readonly kind: 'array';
      readonly item: WasmRule;
      readonly minItems: number;
      readonly title: string;
      readonly description: string;
    }
  | {
      readonly kind: 'object';
      readonly fields: readonly WasmFieldRule[];
      readonly title: string;
      readonly description: string;
    };

/** One field of an object rule. */
export interface WasmFieldRule {
  readonly name: string;
  readonly rule: WasmRule;
  readonly optional?: boolean;
  readonly description: string;
}

/** Published type names of the wasm-layout surface (sorted). */
export const WASM_LAYOUT_TYPE_NAMES = [
  'ComponentFunctionDeclaration',
  'ComponentInterfaceDeclaration',
  'ComponentLayoutDescriptor',
  'LayoutSection',
  'WasmParamDeclaration',
  'WasmSectionKind',
  'WasmValueType',
] as const;

/** One published type name. */
export type WasmLayoutTypeName = (typeof WASM_LAYOUT_TYPE_NAMES)[number];

const WasmValueTypeRule: WasmRule = {
  kind: 'enum',
  values: [...WASM_VALUE_TYPES],
  title: 'WasmValueType',
  description: 'WIT primitive value type: bool, char, f32, f64, s8..s64, string, or u8..u64.',
};

const WasmSectionKindRule: WasmRule = {
  kind: 'enum',
  values: [...WASM_SECTION_KINDS],
  title: 'WasmSectionKind',
  description: 'Canonical Wasm section kind: adapter, core-module, or custom.',
};

const WasmParamDeclarationRule: WasmRule = {
  kind: 'object',
  title: 'WasmParamDeclaration',
  description: 'Wasm component parameter: kebab name plus WIT primitive type.',
  fields: [
    { name: 'name', rule: { kind: 'pattern', pattern: SLUG_PATTERN, title: 'name', description: 'Kebab-case parameter name.' }, description: 'Parameter name.' },
    { name: 'type', rule: WasmValueTypeRule, description: 'Parameter WIT primitive type.' },
  ],
};

const ComponentFunctionDeclarationRule: WasmRule = {
  kind: 'object',
  title: 'ComponentFunctionDeclaration',
  description:
    'One function of a Wasm component interface: kebab name, sorted parameters, optional result type.',
  fields: [
    { name: 'functionName', rule: { kind: 'pattern', pattern: SLUG_PATTERN, title: 'functionName', description: 'Kebab-case function name.' }, description: 'Function name.' },
    { name: 'params', rule: { kind: 'array', item: WasmParamDeclarationRule, minItems: 0, title: 'params', description: 'Sorted, duplicate-free parameters.' }, description: 'Function parameters.' },
    { name: 'result', rule: WasmValueTypeRule, optional: true, description: 'Result type (absent when the function returns nothing).' },
  ],
};

const ComponentInterfaceDeclarationRule: WasmRule = {
  kind: 'object',
  title: 'ComponentInterfaceDeclaration',
  description:
    'One import/export interface of a Wasm component world: WIT-style name (kebab or ns:kebab) and its sorted, duplicate-free function surface.',
  fields: [
    {
      name: 'interfaceName',
      rule: { kind: 'pattern', pattern: WASM_INTERFACE_NAME_PATTERN, title: 'interfaceName', description: 'WIT-style interface name (kebab or ns:kebab).' },
      description: 'Interface name.',
    },
    { name: 'functions', rule: { kind: 'array', item: ComponentFunctionDeclarationRule, minItems: 1, title: 'functions', description: 'Sorted, duplicate-free functions.' }, description: 'Interface functions (at least one).' },
  ],
};

const LayoutSectionRule: WasmRule = {
  kind: 'object',
  title: 'LayoutSection',
  description:
    'Canonical layout section: kebab name, kind (adapter/core-module/custom), byte size, and the SHA-256 content digest of the section bytes.',
  fields: [
    { name: 'name', rule: { kind: 'pattern', pattern: SLUG_PATTERN, title: 'name', description: 'Kebab-case section name; sections are sorted by name.' }, description: 'Section name.' },
    { name: 'kind', rule: WasmSectionKindRule, description: 'Section kind.' },
    { name: 'byteSize', rule: { kind: 'integer', minimum: 0, title: 'byteSize', description: 'Section byte size (non-negative integer).' }, description: 'Section byte size.' },
    { name: 'contentDigest', rule: { kind: 'pattern', pattern: SHA256_HEX_PATTERN, title: 'contentDigest', description: 'Lowercase hex SHA-256 of the section bytes (64 characters).' }, description: 'Section content digest.' },
  ],
};

const ComponentLayoutDescriptorRule: WasmRule = {
  kind: 'object',
  title: 'ComponentLayoutDescriptor',
  description:
    'Canonical Wasm Component Model layout descriptor (host side): component identity, WIT world (imports/exports), and the canonical section layout with per-section digests. Sections/interfaces/functions/params are sorted ascending; at least one export and one section. Host machinery: runtimes/wasm (W008); author-side surface: @epoch/extension-sdk.',
  fields: [
    { name: 'schemaVersion', rule: { kind: 'literal', value: WASM_LAYOUT_SCHEMA_VERSION, title: 'schemaVersion', description: 'Version discriminator (currently 1).' }, description: 'Layout descriptor version.' },
    { name: 'componentId', rule: { kind: 'pattern', pattern: QUALIFIED_NAME_PATTERN, title: 'componentId', description: 'Dot-namespaced qualified component identity.' }, description: 'Component identity.' },
    { name: 'componentVersion', rule: { kind: 'pattern', pattern: SEMVER_CORE_PATTERN, title: 'componentVersion', description: 'Semantic-version core (major.minor.patch).' }, description: 'Component version.' },
    { name: 'worldName', rule: { kind: 'pattern', pattern: SLUG_PATTERN, title: 'worldName', description: 'Kebab-case WIT world name.' }, description: 'WIT world name.' },
    { name: 'imports', rule: { kind: 'array', item: ComponentInterfaceDeclarationRule, minItems: 0, title: 'imports', description: 'Host-provided interfaces, sorted by name.' }, description: 'Imported interfaces.' },
    { name: 'exports', rule: { kind: 'array', item: ComponentInterfaceDeclarationRule, minItems: 1, title: 'exports', description: 'Component-provided interfaces, sorted by name (at least one).' }, description: 'Exported interfaces.' },
    { name: 'sections', rule: { kind: 'array', item: LayoutSectionRule, minItems: 1, title: 'sections', description: 'Canonical sections, sorted by name (at least one).' }, description: 'Canonical sections.' },
  ],
};

/** The complete rule table of the wasm-layout surface (sorted by type name). */
export const WASM_LAYOUT_RULES: Readonly<Record<WasmLayoutTypeName, WasmRule>> = {
  ComponentFunctionDeclaration: ComponentFunctionDeclarationRule,
  ComponentInterfaceDeclaration: ComponentInterfaceDeclarationRule,
  ComponentLayoutDescriptor: ComponentLayoutDescriptorRule,
  LayoutSection: LayoutSectionRule,
  WasmParamDeclaration: WasmParamDeclarationRule,
  WasmSectionKind: WasmSectionKindRule,
  WasmValueType: WasmValueTypeRule,
};
