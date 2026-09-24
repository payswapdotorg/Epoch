/**
 * Deterministic emission of the published contract artifacts under
 * `packages/evidence/schemas/`.
 *
 * `renderEvidenceContractFiles()` is a pure function: it renders the JSON
 * Schema projection (zod 4 `z.toJSONSchema`, draft 2020-12) of every surface
 * entry — each file self-contained, with a versioned `$id`
 * `urn:epoch:evidence:<name>:<contractVersion>` — plus the manifest (with
 * SHA-256 digests of every emitted file) into an ordered map of relative
 * path -> exact file content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte, so
 * committed artifacts can never drift from the implementation schemas. To
 * regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/evidence test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (cross-field
 * invariants such as interval bound ordering) are enforced by the runtime
 * validators and are not represented in the schema files. The manifest
 * records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { EVIDENCE_SCHEMA_SURFACE } from './surface';
import { EVIDENCE_CONTRACT_VERSION, EVIDENCE_RECORD_VERSION } from './version';

/** Repository path of the evidence contract directory (inside the package). */
export const EVIDENCE_CONTRACT_DIR = 'packages/evidence/schemas';

/** Render the complete `packages/evidence/schemas` artifact set. */
export function renderEvidenceContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of EVIDENCE_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/evidence',
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    recordVersion: EVIDENCE_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Evidence contract surface (W006): exact-revision, content-addressed evidence records with W002-aligned confidence. JSON Schema projection under schemas/; runtime validators in @epoch/evidence.',
    dataTypes: EVIDENCE_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/evidence and are not represented in the JSON Schema files',
    emittedBy:
      'renderEvidenceContractFiles() in @epoch/evidence (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(typeName: string, schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
  const withId = {
    ...jsonSchema,
    $id: `urn:epoch:evidence:${typeToKebabCase(typeName)}:${EVIDENCE_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `EvidenceRecord` -> `evidence-record`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
