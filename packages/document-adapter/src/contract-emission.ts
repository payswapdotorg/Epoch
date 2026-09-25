/**
 * Deterministic emission of the published contract artifacts under
 * `packages/document-adapter/schemas/` (same policy as
 * @epoch/evidence, @epoch/capability-registry, and @epoch/tenancy —
 * the in-package versioned contract convention). Regenerate after an
 * intentional schema change with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/document-adapter test contract-drift
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { DOCUMENT_ADAPTER_SCHEMA_SURFACE } from './surface';
import { DOCUMENT_ADAPTER_CONTRACT_VERSION, DOCUMENT_RECORD_VERSION } from './version';

/** Repository path of the document-adapter contract directory (inside the package). */
export const DOCUMENT_ADAPTER_CONTRACT_DIR = 'packages/document-adapter/schemas';

/** Render the complete `packages/document-adapter/schemas` artifact set. */
export function renderDocumentAdapterContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of DOCUMENT_ADAPTER_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/document-adapter',
    contractVersion: DOCUMENT_ADAPTER_CONTRACT_VERSION,
    recordVersion: DOCUMENT_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Document-to-Adapter derivation contract surface (W028): content-addressed document descriptors over deterministic structured document forms, the staged evidence-chained derivation pipeline (Uploaded -> Parsed -> CandidatesExtracted -> ReviewPending -> Provisional, terminal), extraction candidates, provisional adapter definitions with full provenance, W007 source-category registration plans, and the typed error taxonomy including trust-escalation-denied. JSON Schema projection under schemas/; runtime validators in @epoch/document-adapter.',
    dataTypes: DOCUMENT_ADAPTER_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/document-adapter and are not represented in the JSON Schema files',
    emittedBy:
      'renderDocumentAdapterContractFiles() in @epoch/document-adapter (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:document-adapter:${typeToKebabCase(typeName)}:${DOCUMENT_ADAPTER_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `DocumentDescriptor` -> `document-descriptor`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
