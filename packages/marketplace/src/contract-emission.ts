/**
 * Deterministic emission of the published contract artifacts under
 * `packages/marketplace/schemas/`.
 *
 * `renderMarketplaceContractFiles()` is a pure function: it renders the JSON
 * Schema projection (zod 4 `z.toJSONSchema`, draft 2020-12) of every surface
 * entry — each file self-contained, with a versioned `$id`
 * `urn:epoch:marketplace:<name>:<contractVersion>` — plus the manifest (with
 * SHA-256 digests of every emitted file) into an ordered map of relative
 * path -> exact file content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte, so
 * committed artifacts can never drift from the implementation schemas. To
 * regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/marketplace test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (cross-field
 * invariants such as canonical ordering, interval bound ordering, seat
 * bounds) are enforced by the runtime validators and are not represented in
 * the schema files. The manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { MARKETPLACE_SCHEMA_SURFACE } from './surface';
import { MARKETPLACE_CONTRACT_VERSION, MARKETPLACE_RECORD_VERSION } from './version';

/** Repository path of the marketplace contract directory (inside the package). */
export const MARKETPLACE_CONTRACT_DIR = 'packages/marketplace/schemas';

/** Render the complete `packages/marketplace/schemas` artifact set. */
export function renderMarketplaceContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of MARKETPLACE_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/marketplace',
    contractVersion: MARKETPLACE_CONTRACT_VERSION,
    recordVersion: MARKETPLACE_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Marketplace contract surface (W023): immutable content-addressed listing versions, the closed pricing-model vocabulary, W006-shaped trust evidence, entitlement records with pure checks, W010-shaped usage events, developer revenue records, and the PaymentPort seam (checks + record-shaped outcomes only). JSON Schema projection under schemas/; runtime validators in @epoch/marketplace.',
    dataTypes: MARKETPLACE_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/marketplace and are not represented in the JSON Schema files',
    emittedBy:
      'renderMarketplaceContractFiles() in @epoch/marketplace (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(typeName: string, schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
  const withId = {
    ...jsonSchema,
    $id: `urn:epoch:marketplace:${typeToKebabCase(typeName)}:${MARKETPLACE_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `ListingVersionContent` -> `listing-version-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
