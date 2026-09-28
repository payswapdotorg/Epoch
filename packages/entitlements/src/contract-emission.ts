/**
 * Deterministic emission of the published contract artifacts under
 * `packages/entitlements/schemas/`.
 *
 * `renderEntitlementsContractFiles()` is a pure function: it renders the
 * JSON Schema projection (zod 4 `z.toJSONSchema`, draft 2020-12) of every
 * surface entry — each file self-contained, with a versioned `$id`
 * `urn:epoch:entitlements:<name>:<contractVersion>` — plus the manifest
 * (with SHA-256 digests of every emitted file) into an ordered map of
 * relative path -> exact file content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte, so
 * committed artifacts can never drift from the implementation schemas. To
 * regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/entitlements test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (cross-field
 * invariants such as canonical ordering, exact amount arithmetic, status
 * field requirements) are enforced by the runtime validators and are not
 * represented in the schema files. The manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { ENTITLEMENTS_SCHEMA_SURFACE } from './surface';
import { ENTITLEMENTS_CONTRACT_VERSION, ENTITLEMENTS_RECORD_VERSION } from './version';

/** Repository path of the entitlements contract directory (inside the package). */
export const ENTITLEMENTS_CONTRACT_DIR = 'packages/entitlements/schemas';

/** Render the complete `packages/entitlements/schemas` artifact set. */
export function renderEntitlementsContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of ENTITLEMENTS_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/entitlements',
    contractVersion: ENTITLEMENTS_CONTRACT_VERSION,
    recordVersion: ENTITLEMENTS_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Billing + Entitlements contract surface (W024): entitlement resolution riding the W009 tenancy seams over W023 grant records; seat-assignment accounting; billing accounts; sealed invoices with the typed lifecycle draft -> issued -> settled | voided; billable lines derived from the W023 pricing vocabulary, usage accounts, and W036 validated actuals; the SettlementPort seam (checks + record-shaped outcomes only); and entitlements:*/billing:* events over the W010 event shapes. JSON Schema projection under schemas/; runtime validators in @epoch/entitlements.',
    dataTypes: ENTITLEMENTS_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/entitlements and are not represented in the JSON Schema files',
    emittedBy:
      'renderEntitlementsContractFiles() in @epoch/entitlements (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(typeName: string, schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
  const withId = {
    ...jsonSchema,
    $id: `urn:epoch:entitlements:${typeToKebabCase(typeName)}:${ENTITLEMENTS_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `InvoiceContent` -> `invoice-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
