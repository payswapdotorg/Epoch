/**
 * Deterministic emission of the published contract artifacts under
 * `packages/adapter-sdk/schemas/` (same policy as @epoch/evidence and
 * @epoch/verification). Regenerate after an intentional schema change
 * with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/adapter-sdk test contract-drift
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { ADAPTER_SDK_SCHEMA_SURFACE } from './surface';
import {
  ADAPTER_DESCRIPTOR_VERSION,
  ADAPTER_ENVELOPE_VERSION,
  ADAPTER_SDK_CONTRACT_VERSION,
} from './version';

/** Repository path of the adapter-sdk contract directory (inside the package). */
export const ADAPTER_SDK_CONTRACT_DIR = 'packages/adapter-sdk/schemas';

/** Render the complete `packages/adapter-sdk/schemas` artifact set. */
export function renderAdapterSdkContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of ADAPTER_SDK_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/adapter-sdk',
    contractVersion: ADAPTER_SDK_CONTRACT_VERSION,
    descriptorVersion: ADAPTER_DESCRIPTOR_VERSION,
    envelopeVersion: ADAPTER_ENVELOPE_VERSION,
    description:
      'Typed, versioned, provider-neutral Adapter SDK contract surface (W007): per-category request/response payloads (W003/W005/W006-aligned where they meet), capability bindings, binding pins, and content-addressed adapter descriptors. Zero concrete adapters. JSON Schema projection under schemas/; runtime validators in @epoch/adapter-sdk.',
    dataTypes: ADAPTER_SDK_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/adapter-sdk and are not represented in the JSON Schema files',
    emittedBy:
      'renderAdapterSdkContractFiles() in @epoch/adapter-sdk (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:adapter-sdk:${typeToKebabCase(typeName)}:${ADAPTER_SDK_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `AdapterDescriptor` -> `adapter-descriptor`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
