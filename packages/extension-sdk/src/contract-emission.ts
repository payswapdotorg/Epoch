/**
 * Deterministic emission of the published contract artifacts under
 * `packages/extension-sdk/schemas/` (the W007 in-package pattern; same
 * policy as @epoch/capability-registry and @epoch/adapter-sdk).
 * Regenerate after an intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/extension-sdk test contract-drift
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { EXTENSION_SDK_SCHEMA_SURFACE } from './surface';
import { EXTENSION_MANIFEST_VERSION, EXTENSION_SDK_CONTRACT_VERSION } from './version';

/** Repository path of the extension-sdk contract directory (inside the package). */
export const EXTENSION_SDK_CONTRACT_DIR = 'packages/extension-sdk/schemas';

/** Render the complete `packages/extension-sdk/schemas` artifact set. */
export function renderExtensionSdkContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of EXTENSION_SDK_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/extension-sdk',
    contractVersion: EXTENSION_SDK_CONTRACT_VERSION,
    recordVersion: EXTENSION_MANIFEST_VERSION,
    description:
      'Typed, versioned, provider-neutral Extension SDK contract surface (W008): declarative extension manifests across the four flavors (declarative, ui, wasm, remote), capability-scoped permission grants with trust-class ceilings, the narrow typed host-function contract surface, and deterministic content-addressed serialization. JSON Schema projection under schemas/; runtime validators in @epoch/extension-sdk. Host-side sandbox machinery: @epoch/extension-runtime; Wasm layout machinery: runtimes/wasm.',
    dataTypes: EXTENSION_SDK_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (sorted-set semantics, grants-subset-bindings, trust-class ceilings, flavor match, legal resource scopes, external-transfer gating) are enforced by the runtime validators in @epoch/extension-sdk and are not represented in the JSON Schema files',
    emittedBy:
      'renderExtensionSdkContractFiles() in @epoch/extension-sdk (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:extension-sdk:${typeToKebabCase(typeName)}:${EXTENSION_SDK_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `ExtensionManifest` -> `extension-manifest`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
