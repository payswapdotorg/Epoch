/**
 * Deterministic emission of the published contract artifacts under
 * `packages/authorization/schemas/` (same policy as
 * @epoch/capability-registry and @epoch/extension-sdk). Regenerate after
 * an intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/authorization test contract-drift
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { AUTHORIZATION_SCHEMA_SURFACE } from './surface';
import {
  AUTHORIZATION_CONTRACT_VERSION,
  AUTHORIZATION_RECORD_VERSION,
} from './version';

/** Repository path of the authorization contract directory (inside the package). */
export const AUTHORIZATION_CONTRACT_DIR = 'packages/authorization/schemas';

/** Render the complete `packages/authorization/schemas` artifact set. */
export function renderAuthorizationContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of AUTHORIZATION_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/authorization',
    contractVersion: AUTHORIZATION_CONTRACT_VERSION,
    recordVersion: AUTHORIZATION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Authorization contract surface (W009): the decision point over opaque principal/tenant/resource ids — authorization requests (principal + tenant scope + resource reference + action), decisions (allow/deny/not-applicable with typed reasons and exact evidence paths), fail-closed tenant isolation, and content-addressed decision records. Policy semantics stay in W004. JSON Schema projection under schemas/; runtime validators in @epoch/authorization.',
    dataTypes: AUTHORIZATION_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/authorization and are not represented in the JSON Schema files',
    emittedBy:
      'renderAuthorizationContractFiles() in @epoch/authorization (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:authorization:${typeToKebabCase(typeName)}:${AUTHORIZATION_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `AuthorizationRequest` -> `authorization-request`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
