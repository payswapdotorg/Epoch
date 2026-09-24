/**
 * Deterministic emission of the published contract artifacts under
 * `runtimes/wasm/schemas/` — the JSON Schema (draft 2020-12) projection
 * of the rule table in src/rules.ts. The rule table is the single
 * source of truth: this emitter renders it, and
 * test/schema-drift.test.ts pins the committed files byte-identical to
 * the emission (regeneration only via EPOCH_UPDATE_CONTRACTS=1).
 *
 * Fidelity note (mirrors the W007 contract manifests): the projection
 * is STRUCTURAL-ONLY — the canonical-ordering semantic layer (sorted +
 * duplicate-free arrays) is enforced by the runtime validator in
 * src/validate.ts and is not representable in JSON Schema.
 */
import { sha256Hex } from './digest';
import { WASM_LAYOUT_RULES, WASM_LAYOUT_TYPE_NAMES, type WasmRule } from './rules';
import { WASM_LAYOUT_CONTRACT_VERSION, WASM_LAYOUT_SCHEMA_VERSION } from './version';

/** Repository path of the wasm-layout contract directory. */
export const WASM_LAYOUT_CONTRACT_DIR = 'runtimes/wasm/schemas';

/** Render the complete `runtimes/wasm/schemas` artifact set. */
export function renderWasmLayoutContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const typeName of WASM_LAYOUT_TYPE_NAMES) {
    const file = `${typeToKebabCase(typeName)}.schema.json`;
    const content = renderSchemaFile(typeName, WASM_LAYOUT_RULES[typeName]);
    files[file] = content;
    schemas.push({ type: typeName, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/wasm-layout',
    contractVersion: WASM_LAYOUT_CONTRACT_VERSION,
    recordVersion: WASM_LAYOUT_SCHEMA_VERSION,
    description:
      'Typed, versioned, provider-neutral Wasm Component Model HOST-side layout contract surface (W008): canonical component layout descriptor, interface/function/parameter declarations, and canonical sections with content digests. JSON Schema projection under schemas/; runtime validation machinery in runtimes/wasm (self-contained, zero imports). Author-side surface: @epoch/extension-sdk; shape compatibility pinned by the shared committed fixture under runtimes/wasm/test/fixtures/.',
    dataTypes: [...WASM_LAYOUT_TYPE_NAMES],
    jsonSchemaFidelity:
      'structural-only: the canonical-ordering semantic layer (sorted + duplicate-free arrays) is enforced by the runtime validator in runtimes/wasm/src/validate.ts and is not represented in the JSON Schema files',
    emittedBy:
      'renderWasmLayoutContractFiles() in runtimes/wasm (rule-table render, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(typeName: string, rule: WasmRule): string {
  const jsonSchema = renderRule(rule, typeName);
  const withId = {
    ...jsonSchema,
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `urn:epoch:wasm-layout:${typeToKebabCase(typeName)}:${WASM_LAYOUT_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

function renderRule(rule: WasmRule, fallbackTitle: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    title: rule.title || fallbackTitle,
    description: rule.description,
  };
  switch (rule.kind) {
    case 'literal':
      return {
        ...base,
        type: typeof rule.value === 'number' ? 'integer' : 'string',
        const: rule.value,
      };
    case 'pattern':
      return { ...base, type: 'string', pattern: rule.pattern.source };
    case 'enum':
      return { ...base, type: 'string', enum: [...rule.values] };
    case 'integer':
      return { ...base, type: 'integer', minimum: rule.minimum };
    case 'array':
      return {
        ...base,
        type: 'array',
        items: renderRule(rule.item, rule.item.title || 'item'),
        minItems: rule.minItems,
      };
    case 'object': {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const field of rule.fields) {
        properties[field.name] = renderRule(field.rule, field.rule.title || field.name);
        if (field.optional !== true) required.push(field.name);
      }
      return {
        ...base,
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      };
    }
  }
}

/** `ComponentLayoutDescriptor` -> `component-layout-descriptor`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
