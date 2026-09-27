/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderVarianceContractFiles()` renders the IN-PACKAGE full surface
 * under `packages/variance/schemas` (the W006/W007/W009/W023/W036
 * in-package convention) — the W039 owned surfaces include NO
 * contracts/variance tree, so this is the kernel's one published
 * artifact set. Pure function: each schema file is self-contained with a
 * versioned `$id` `urn:epoch:variance:<name>:<contractVersion>`, and the
 * manifest carries SHA-256 digests of every emitted file, into an
 * ordered map of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation
 * schemas. To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/variance test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, evidence-required) are enforced by
 * the runtime validators and are not represented in the schema files.
 * The manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { VARIANCE_SCHEMA_SURFACE } from './surface';
import { VARIANCE_CONTRACT_VERSION, VARIANCE_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const VARIANCE_CONTRACT_DIR = 'packages/variance/schemas';

/** Render the complete `packages/variance/schemas` artifact set. */
export function renderVarianceContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of VARIANCE_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/variance',
    contractVersion: VARIANCE_CONTRACT_VERSION,
    recordVersion: VARIANCE_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Variance contract surface (W039, in-package full surface): the full variance class set as sealed records (quantity/price-rate/productivity/schedule/waste/rework/change/external-condition with magnitude + direction + band), root-cause attribution with mandatory W006-convention evidence, and the immutable historical prediction comparison (forecast revisions and forecast-vs-actual). Compared lines are opaque exact-revision references. JSON Schema projection under schemas/; runtime validators in @epoch/variance.',
    dataTypes: VARIANCE_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, evidence-required, cross-field invariants, digest verification, tenant checks) are enforced by the runtime validators in @epoch/variance and are not represented in the JSON Schema files',
    emittedBy:
      'renderVarianceContractFiles() in @epoch/variance (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:variance:${typeToKebabCase(typeName)}:${VARIANCE_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `VarianceRecordContent` -> `variance-record-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
