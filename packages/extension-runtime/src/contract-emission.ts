/**
 * Deterministic emission of the published contract artifacts under
 * `packages/extension-runtime/schemas/` (the W007 in-package pattern).
 * Regenerate after an intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/extension-runtime test contract-drift
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { EXTENSION_RUNTIME_SCHEMA_SURFACE } from './surface';
import {
  EXTENSION_INVOCATION_ENVELOPE_VERSION,
  EXTENSION_RUNTIME_CONTRACT_VERSION,
} from './version';

/** Repository path of the extension-runtime contract directory (inside the package). */
export const EXTENSION_RUNTIME_CONTRACT_DIR = 'packages/extension-runtime/schemas';

/** Render the complete `packages/extension-runtime/schemas` artifact set. */
export function renderExtensionRuntimeContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of EXTENSION_RUNTIME_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/extension-runtime',
    contractVersion: EXTENSION_RUNTIME_CONTRACT_VERSION,
    recordVersion: EXTENSION_INVOCATION_ENVELOPE_VERSION,
    description:
      'Typed, versioned, provider-neutral Extension Runtime contract surface (W008): invocation envelopes, execution outcomes, resolved binding pins, grant descriptions, admitted records, audit records, and deterministic sandbox surface descriptions. JSON Schema projection under schemas/; runtime validators in @epoch/extension-runtime. The manifest mirror is internal admission machinery, parity-pinned against @epoch/extension-sdk (devDependency tests) and deliberately not re-emitted here — the SDK owns that contract emission. Wasm host-side layout machinery: runtimes/wasm.',
    dataTypes: EXTENSION_RUNTIME_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (sorted-set semantics) are enforced by the runtime validators in @epoch/extension-runtime and are not represented in the JSON Schema files',
    emittedBy:
      'renderExtensionRuntimeContractFiles() in @epoch/extension-runtime (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(typeName: string, schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >;
  const withId = {
    ...jsonSchema,
    $id: `urn:epoch:extension-runtime:${typeToKebabCase(typeName)}:${EXTENSION_RUNTIME_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `HostInvocationEnvelope` -> `host-invocation-envelope`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
