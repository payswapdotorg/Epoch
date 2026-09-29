/**
 * Deterministic emission of the published contract artifacts under
 * `services/developer-portal/contracts/` (the W012 declaration-only tree).
 *
 * `renderDeveloperPortalContractFiles()` is a pure function: it renders
 * the JSON Schema projection (zod 4 `z.toJSONSchema`, draft 2020-12) of
 * every portal-owned surface entry — each file self-contained, with a
 * versioned `$id` `urn:epoch:developer-portal:<name>:<contractVersion>` —
 * plus the manifest (with SHA-256 digests of every emitted file) into an
 * ordered map of relative path (under `contracts/`) -> exact file
 * content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation
 * schemas. To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/developer-portal-host test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (the
 * same-stream strictly-earlier causal parent) are enforced by the
 * runtime validators and are not represented in the schema files. The
 * manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { DEVELOPER_PORTAL_SCHEMA_SURFACE } from './surface';
import { DEVELOPER_PORTAL_CONTRACT_VERSION, HOST_RECORD_VERSION } from './version';

/** Repository path of the developer-portal contract directory. */
export const DEVELOPER_PORTAL_CONTRACT_DIR = 'services/developer-portal/contracts';

/** Render the complete `services/developer-portal/contracts` schema artifact set. */
export function renderDeveloperPortalContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of DEVELOPER_PORTAL_SCHEMA_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/developer-portal',
    contractVersion: DEVELOPER_PORTAL_CONTRACT_VERSION,
    recordVersion: HOST_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Developer Portal contract surface (W025): the portal-owned host records (listing snapshots, publication/adoption receipts, the developer dashboard, health/describe) and the portal:* event vocabulary over the W010 event shapes. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/. Upstream records (W007 capability records, W023 sealed listing versions, W024 billing accounts) stay the owning packages\' contracts.',
    dataTypes: DEVELOPER_PORTAL_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (the same-stream strictly-earlier causal parent) are enforced by the runtime validators in @epoch/developer-portal-host and are not represented in the JSON Schema files',
    emittedBy:
      'renderDeveloperPortalContractFiles() in @epoch/developer-portal-host (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(typeName: string, schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
  const withId = {
    ...jsonSchema,
    $id: `urn:epoch:developer-portal:${typeToKebabCase(typeName)}:${DEVELOPER_PORTAL_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `ListingVersionContent` -> `listing-version-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
