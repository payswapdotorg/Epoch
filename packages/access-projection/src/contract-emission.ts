/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderAccessProjectionContractFiles()` renders the IN-PACKAGE full
 * surface under `packages/access-projection/schemas` (the W006/W007/
 * W009/W023/W036 in-package convention);
 * `renderAccessProjectionPublicContractFiles()` renders the CORE record
 * projection under `contracts/access-projection/` (the W012
 * public-contract convention: schemas/ + manifest). Both are pure
 * functions: each schema file is self-contained with a versioned `$id`
 * `urn:epoch:access-projection:<name>:<contractVersion>`, and the
 * manifests carry SHA-256 digests of every emitted file, into ordered
 * maps of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation
 * schemas. To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/access-projection test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, digest verification) are enforced by
 * the runtime validators and are not represented in the schema files.
 * The manifests record this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { ACCESS_PROJECTION_SCHEMA_SURFACE, CORE_RECORD_SURFACE } from './surface';
import { ACCESS_PROJECTION_CONTRACT_VERSION, ACCESS_PROJECTION_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const ACCESS_PROJECTION_CONTRACT_DIR = 'packages/access-projection/schemas';

/** Repository path of the public core-record contract directory (W012 convention). */
export const ACCESS_PROJECTION_PUBLIC_CONTRACT_DIR = 'contracts/access-projection';

/** Render the complete `packages/access-projection/schemas` artifact set. */
export function renderAccessProjectionContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of ACCESS_PROJECTION_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/access-projection',
    contractVersion: ACCESS_PROJECTION_CONTRACT_VERSION,
    recordVersion: ACCESS_PROJECTION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Access Projection contract surface (W041, in-package full surface): projection policies as sealed data (role/task-class x object-class bindings with allowed actions, minimum-necessary field allowlists, evidence/commercial/supplier scope filters and redaction rules), the two-stage evaluation over W009 decisions and canonical W036 records, authorized projections with typed redaction markers and stable object identity, the content-addressed audit trail with the evaluation-key replay discipline, and the access-projection:* event vocabulary over the W010 event shapes. JSON Schema projection under schemas/; runtime validators in @epoch/access-projection.',
    dataTypes: ACCESS_PROJECTION_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, digest verification, tenant checks) are enforced by the runtime validators in @epoch/access-projection and are not represented in the JSON Schema files',
    emittedBy:
      'renderAccessProjectionContractFiles() in @epoch/access-projection (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

/** Render the `contracts/access-projection` public artifact set (core records). */
export function renderAccessProjectionPublicContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of CORE_RECORD_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/access-projection',
    contractVersion: ACCESS_PROJECTION_CONTRACT_VERSION,
    recordVersion: ACCESS_PROJECTION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Access Projection public contract surface (W041, W012 convention): the CORE record types a domain pack or downstream consumer binds to — sealed projection policies (policy is data), task projection contexts, canonical record references, authorized projections with released fields and typed redaction markers, the sealed projection audit records, and access-projection events over the W010 shapes. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: CORE_RECORD_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/access-projection and are not represented in the JSON Schema files',
    emittedBy:
      'renderAccessProjectionPublicContractFiles() in @epoch/access-projection (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:access-projection:${typeToKebabCase(typeName)}:${ACCESS_PROJECTION_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `ProjectionPolicyContent` -> `projection-policy-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
