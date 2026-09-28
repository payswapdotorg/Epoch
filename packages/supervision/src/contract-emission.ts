/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderSupervisionContractFiles()` renders the IN-PACKAGE full surface
 * under `packages/supervision/schemas` (the W006/W007/W009/W023/W036/
 * W038 in-package convention). The PUBLIC core-record projection under
 * `contracts/supervision` (the W012 convention) is composed with the
 * alerts-kernel core records by the supervision-runtime service — the
 * only W043 component depending on both kernels (see
 * services/supervision/src/contract-emission.ts).
 *
 * Pure functions: each schema file is self-contained with a versioned
 * `$id` `urn:epoch:supervision:<name>:<contractVersion>`, and the
 * manifest carries SHA-256 digests of every emitted file, into ordered
 * maps of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares byte-for-byte.
 * To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/supervision test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, chain checks) are enforced by the
 * runtime validators and are not represented in the schema files. The
 * manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { SUPERVISION_SCHEMA_SURFACE } from './surface';
import { SUPERVISION_CONTRACT_VERSION, SUPERVISION_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const SUPERVISION_CONTRACT_DIR = 'packages/supervision/schemas';

/** Repository path of the public core-record contract directory (W012 convention). */
export const SUPERVISION_PUBLIC_CONTRACT_DIR = 'contracts/supervision';

/** Render the complete `packages/supervision/schemas` artifact set. */
export function renderSupervisionContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of SUPERVISION_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/supervision',
    contractVersion: SUPERVISION_CONTRACT_VERSION,
    recordVersion: SUPERVISION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Delivery Supervision contract surface (W043, in-package full surface): planned-vs-actual / critical-path / prerequisite / lead-time / consumption / verification / unresolved-unknown findings (content-addressed, W006-convention provenance), the W038-shaped execution-issue summaries and W037-shaped lead-time risk inputs (opaque typed references), the typed anomaly thresholds, the sealed supervision pass, and the supervision:* event vocabulary over the W010 shapes. JSON Schema projection under schemas/; runtime validators in @epoch/supervision.',
    dataTypes: SUPERVISION_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, digest verification, tenant checks) are enforced by the runtime validators in @epoch/supervision and are not represented in the JSON Schema files',
    emittedBy:
      'renderSupervisionContractFiles() in @epoch/supervision (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:supervision:${typeToKebabCase(typeName)}:${SUPERVISION_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `SupervisionPassContent` -> `supervision-pass-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
