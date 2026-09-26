/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderExecutionTrackingContractFiles()` renders the IN-PACKAGE full
 * surface under `packages/execution-tracking/schemas` (the
 * W006/W007/W009/W023/W036 in-package convention);
 * `renderExecutionTrackingPublicContractFiles()` renders the CORE record
 * projection under `contracts/execution/` (the W012 public-contract
 * convention: schemas/ + manifest). Both are pure functions: each schema
 * file is self-contained with a versioned `$id`
 * `urn:epoch:execution-tracking:<name>:<contractVersion>`, and the
 * manifests carry SHA-256 digests of every emitted file, into ordered maps
 * of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares byte-for-byte, so
 * committed artifacts can never drift from the implementation schemas. To
 * regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/execution-tracking test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, chain checks) are enforced by the
 * runtime validators and are not represented in the schema files. The
 * manifests record this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { CORE_RECORD_SURFACE, EXECUTION_TRACKING_SCHEMA_SURFACE } from './surface';
import { EXECUTION_TRACKING_CONTRACT_VERSION, EXECUTION_TRACKING_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const EXECUTION_TRACKING_CONTRACT_DIR = 'packages/execution-tracking/schemas';

/** Repository path of the public core-record contract directory (W012 convention). */
export const EXECUTION_TRACKING_PUBLIC_CONTRACT_DIR = 'contracts/execution';

/** Render the complete `packages/execution-tracking/schemas` artifact set. */
export function renderExecutionTrackingContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of EXECUTION_TRACKING_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/execution-tracking',
    contractVersion: EXECUTION_TRACKING_CONTRACT_VERSION,
    recordVersion: EXECUTION_TRACKING_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Execution Tracking contract surface (W038, in-package full surface): work-package/activity tracking-state records (append-only chains observing the ProgramOfWork by opaque id), labor/equipment/material resource observations, field-evidence references by W006 digest with capture context, the change/delay/rework/defect/blocker issue families with resolutions, reconciliation proposals over the W036 observation/actualization authority, the low-friction field capture, and the execution:* event vocabulary over the W010 shapes. JSON Schema projection under schemas/; runtime validators in @epoch/execution-tracking.',
    dataTypes: EXECUTION_TRACKING_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, chain checks, digest verification, tenant checks) are enforced by the runtime validators in @epoch/execution-tracking and are not represented in the JSON Schema files',
    emittedBy:
      'renderExecutionTrackingContractFiles() in @epoch/execution-tracking (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

/** Render the `contracts/execution` public artifact set (core records). */
export function renderExecutionTrackingPublicContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of CORE_RECORD_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/execution-tracking',
    contractVersion: EXECUTION_TRACKING_CONTRACT_VERSION,
    recordVersion: EXECUTION_TRACKING_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Execution Tracking public contract surface (W038, W012 convention): the CORE record types a domain pack or downstream consumer binds to — tracking-state records, resource observations, field-evidence references with capture context, the issue families with resolutions, reconciliation proposals, the low-friction field capture, and execution events over the W010 shapes. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: CORE_RECORD_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/execution-tracking and are not represented in the JSON Schema files',
    emittedBy:
      'renderExecutionTrackingPublicContractFiles() in @epoch/execution-tracking (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:execution-tracking:${typeToKebabCase(typeName)}:${EXECUTION_TRACKING_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `TrackingStateRecordContent` -> `tracking-state-record-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
