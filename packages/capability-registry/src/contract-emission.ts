/**
 * Deterministic emission of the published contract artifacts under
 * `packages/capability-registry/schemas/` (same policy as
 * @epoch/evidence and @epoch/verification). Regenerate after an
 * intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/capability-registry test contract-drift
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { CAPABILITY_REGISTRY_SCHEMA_SURFACE } from './surface';
import {
  CAPABILITY_MANIFEST_VERSION,
  CAPABILITY_REGISTRY_CONTRACT_VERSION,
} from './version';

/** Repository path of the capability-registry contract directory (inside the package). */
export const CAPABILITY_REGISTRY_CONTRACT_DIR = 'packages/capability-registry/schemas';

/** Render the complete `packages/capability-registry/schemas` artifact set. */
export function renderCapabilityRegistryContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of CAPABILITY_REGISTRY_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/capability-registry',
    contractVersion: CAPABILITY_REGISTRY_CONTRACT_VERSION,
    recordVersion: CAPABILITY_MANIFEST_VERSION,
    description:
      'Typed, versioned, provider-neutral Capability Registry contract surface (W007): content-addressed capability manifests across the eight Capability Fabric adapter categories, with typed lifecycle and version-constrained resolution. JSON Schema projection under schemas/; runtime validators in @epoch/capability-registry.',
    dataTypes: CAPABILITY_REGISTRY_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/capability-registry and are not represented in the JSON Schema files',
    emittedBy:
      'renderCapabilityRegistryContractFiles() in @epoch/capability-registry (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:capability-registry:${typeToKebabCase(typeName)}:${CAPABILITY_REGISTRY_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `CapabilityManifest` -> `capability-manifest`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
