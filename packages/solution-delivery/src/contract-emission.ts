/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderSolutionDeliveryContractFiles()` renders the IN-PACKAGE full
 * surface under `packages/solution-delivery/schemas` (the W006/W007/W009/
 * W023 in-package convention); `renderSolutionDeliveryPublicContractFiles()`
 * renders the CORE record projection under `contracts/solution-delivery/`
 * (the W012 public-contract convention: schemas/ + manifest). Both are
 * pure functions: each schema file is self-contained with a versioned `$id`
 * `urn:epoch:solution-delivery:<name>:<contractVersion>`, and the
 * manifests carry SHA-256 digests of every emitted file, into ordered maps
 * of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares byte-for-byte, so
 * committed artifacts can never drift from the implementation schemas. To
 * regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/solution-delivery test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, dependency mirrors) are enforced by
 * the runtime validators and are not represented in the schema files. The
 * manifests record this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { CORE_RECORD_SURFACE, SOLUTION_DELIVERY_SCHEMA_SURFACE } from './surface';
import { SOLUTION_DELIVERY_CONTRACT_VERSION, SOLUTION_DELIVERY_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const SOLUTION_DELIVERY_CONTRACT_DIR = 'packages/solution-delivery/schemas';

/** Repository path of the public core-record contract directory (W012 convention). */
export const SOLUTION_DELIVERY_PUBLIC_CONTRACT_DIR = 'contracts/solution-delivery';

/** Render the complete `packages/solution-delivery/schemas` artifact set. */
export function renderSolutionDeliveryContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of SOLUTION_DELIVERY_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/solution-delivery',
    contractVersion: SOLUTION_DELIVERY_CONTRACT_VERSION,
    recordVersion: SOLUTION_DELIVERY_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Solution Delivery contract surface (W036, in-package full surface): immutable hash-chained solution version baselines, the nine semantic-distinction record types, the ProgramOfWork schedule dimension, DeliveryRecord observation/acceptance/actualization, the universal lifecycle stage/transition records, acquisition/realization variant catalogs, information-acquisition requests, the provider-neutral external request/event seam, and the delivery:* event vocabulary over the W010 event shapes. JSON Schema projection under schemas/; runtime validators in @epoch/solution-delivery.',
    dataTypes: SOLUTION_DELIVERY_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, dependency mirrors, digest verification, tenant checks) are enforced by the runtime validators in @epoch/solution-delivery and are not represented in the JSON Schema files',
    emittedBy:
      'renderSolutionDeliveryContractFiles() in @epoch/solution-delivery (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

/** Render the `contracts/solution-delivery` public artifact set (core records). */
export function renderSolutionDeliveryPublicContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of CORE_RECORD_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/solution-delivery',
    contractVersion: SOLUTION_DELIVERY_CONTRACT_VERSION,
    recordVersion: SOLUTION_DELIVERY_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Solution Delivery public contract surface (W036, W012 convention): the CORE record types a domain pack or downstream consumer binds to — sealed solution versions and baseline approvals, the nine semantic-distinction records, work packages/activities/milestones, the sealed ProgramOfWork, the sealed DeliveryRecord, lifecycle stage/transition records, acquisition requests, information-acquisition requests, the external request/event seam, delivery events, and the pack profile. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: CORE_RECORD_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/solution-delivery and are not represented in the JSON Schema files',
    emittedBy:
      'renderSolutionDeliveryPublicContractFiles() in @epoch/solution-delivery (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:solution-delivery:${typeToKebabCase(typeName)}:${SOLUTION_DELIVERY_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `SolutionVersionContent` -> `solution-version-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
