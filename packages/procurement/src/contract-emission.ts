/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderProcurementContractFiles()` renders the IN-PACKAGE full
 * surface under `packages/procurement/schemas` (the W006/W007/W009/
 * W023/W036 in-package convention); `renderProcurementPublicContractFiles()`
 * renders the CORE record projection under `contracts/procurement/`
 * (the W012 public-contract convention: schemas/ + manifest). Both are
 * pure functions: each schema file is self-contained with a versioned
 * `$id` `urn:epoch:procurement:<name>:<contractVersion>`, and the
 * manifests carry SHA-256 digests of every emitted file, into ordered
 * maps of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation
 * schemas. To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/procurement test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, chain mirrors) are enforced by the
 * runtime validators and are not represented in the schema files. The
 * manifests record this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { CORE_RECORD_SURFACE, PROCUREMENT_SCHEMA_SURFACE } from './surface';
import { PROCUREMENT_CONTRACT_VERSION, PROCUREMENT_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const PROCUREMENT_CONTRACT_DIR = 'packages/procurement/schemas';

/** Repository path of the public core-record contract directory (W012 convention). */
export const PROCUREMENT_PUBLIC_CONTRACT_DIR = 'contracts/procurement';

/** Render the complete `packages/procurement/schemas` artifact set. */
export function renderProcurementContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of PROCUREMENT_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/procurement',
    contractVersion: PROCUREMENT_CONTRACT_VERSION,
    recordVersion: PROCUREMENT_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Procurement contract surface (W037, in-package full surface): requirement-to-acquisition-package lineage, sealed commercial packages over the W036 Acquire contract, quotes/offers/allocations with typed Prediction/Estimate lead-time references, hash-chained quote selections, W036 commitment linkage, version-chained purchase orders, the supplier-delivery state machine with accumulating receipts linked to W036 observation intake, substitution requests with the constraint-evaluation gate, the derived-only acquisition-status projection, and the procurement:* event vocabulary over the W010 event shapes. JSON Schema projection under schemas/; runtime validators in @epoch/procurement.',
    dataTypes: PROCUREMENT_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, chain mirrors, digest verification, tenant checks) are enforced by the runtime validators in @epoch/procurement and are not represented in the JSON Schema files',
    emittedBy:
      'renderProcurementContractFiles() in @epoch/procurement (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

/** Render the `contracts/procurement` public artifact set (core records). */
export function renderProcurementPublicContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of CORE_RECORD_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/procurement',
    contractVersion: PROCUREMENT_CONTRACT_VERSION,
    recordVersion: PROCUREMENT_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Procurement public contract surface (W037, W012 convention): the CORE record types a domain pack or downstream consumer binds to — sealed requirement lineage, acquisition packages, quotes with typed lead-time references, recorded quote selections, commitment references, version-chained purchase orders, supplier-delivery transitions with receipts, substitution requests with the constraint-evaluation reference, the derived acquisition-status projection, and procurement events over the W010 shapes. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: CORE_RECORD_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/procurement and are not represented in the JSON Schema files',
    emittedBy:
      'renderProcurementPublicContractFiles() in @epoch/procurement (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:procurement:${typeToKebabCase(typeName)}:${PROCUREMENT_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `RequirementLineageContent` -> `requirement-lineage-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
