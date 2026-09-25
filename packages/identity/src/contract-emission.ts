/**
 * Deterministic emission of the published contract artifacts under
 * `packages/identity/schemas/` (same policy as
 * @epoch/capability-registry and @epoch/extension-sdk). Regenerate after
 * an intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/identity test contract-drift
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { IDENTITY_SCHEMA_SURFACE } from './surface';
import { IDENTITY_CONTRACT_VERSION, IDENTITY_RECORD_VERSION } from './version';

/** Repository path of the identity contract directory (inside the package). */
export const IDENTITY_CONTRACT_DIR = 'packages/identity/schemas';

/** Render the complete `packages/identity/schemas` artifact set. */
export function renderIdentityContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of IDENTITY_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/identity',
    contractVersion: IDENTITY_CONTRACT_VERSION,
    recordVersion: IDENTITY_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Identity contract surface (W009): principal modeling across the five principal kinds, credential-assertion descriptors over the factor-class taxonomy, authentication-result records with typed reasons, and content-addressed audit records. Zero concrete providers, zero network, zero secrets storage. JSON Schema projection under schemas/; runtime validators in @epoch/identity.',
    dataTypes: IDENTITY_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/identity and are not represented in the JSON Schema files',
    emittedBy:
      'renderIdentityContractFiles() in @epoch/identity (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:identity:${typeToKebabCase(typeName)}:${IDENTITY_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `PrincipalKind` -> `principal-kind`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
