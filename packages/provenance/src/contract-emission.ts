/**
 * Deterministic emission of the published contract artifacts under
 * `packages/provenance/schemas/` (same policy as @epoch/evidence; see that
 * package's contract-emission.ts for the full rationale). Regenerate after
 * an intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/provenance test contract-drift
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { PROVENANCE_SCHEMA_SURFACE } from './surface';
import { PROVENANCE_CONTRACT_VERSION, PROVENANCE_RECORD_VERSION } from './version';

/** Repository path of the provenance contract directory (inside the package). */
export const PROVENANCE_CONTRACT_DIR = 'packages/provenance/schemas';

/** Render the complete `packages/provenance/schemas` artifact set. */
export function renderProvenanceContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of PROVENANCE_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/provenance',
    contractVersion: PROVENANCE_CONTRACT_VERSION,
    recordVersion: PROVENANCE_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Provenance contract surface (W006): PROV-DM-adapted agents, activities, entities, and the six core relation statements. JSON Schema projection under schemas/; runtime validators in @epoch/provenance.',
    dataTypes: PROVENANCE_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/provenance and are not represented in the JSON Schema files',
    emittedBy:
      'renderProvenanceContractFiles() in @epoch/provenance (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(typeName: string, schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
  const withId = {
    ...jsonSchema,
    $id: `urn:epoch:provenance:${typeToKebabCase(typeName)}:${PROVENANCE_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `ProvenanceGraph` -> `provenance-graph`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
