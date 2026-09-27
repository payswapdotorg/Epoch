/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderActualizationContractFiles()` renders the IN-PACKAGE full
 * surface under `packages/actualization/schemas` (the W006/W007/W009/
 * W023/W036 in-package convention); `renderActualizationPublicContractFiles()`
 * renders the CORE record projection under `contracts/actualization/`
 * (the W012 public-contract convention: schemas/ + manifest). Both are
 * pure functions: each schema file is self-contained with a versioned
 * `$id` `urn:epoch:actualization:<name>:<contractVersion>`, and the
 * manifests carry SHA-256 digests of every emitted file, into ordered
 * maps of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares byte-for-byte, so
 * committed artifacts can never drift from the implementation schemas. To
 * regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/actualization test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, stage-order rules) are enforced by
 * the runtime validators and are not represented in the schema files.
 * The manifests record this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { ACTUALIZATION_SCHEMA_SURFACE, CORE_RECORD_SURFACE } from './surface';
import { ACTUALIZATION_CONTRACT_VERSION, ACTUALIZATION_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const ACTUALIZATION_CONTRACT_DIR = 'packages/actualization/schemas';

/** Repository path of the public core-record contract directory (W012 convention). */
export const ACTUALIZATION_PUBLIC_CONTRACT_DIR = 'contracts/actualization';

/** Render the complete `packages/actualization/schemas` artifact set. */
export function renderActualizationContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of ACTUALIZATION_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/actualization',
    contractVersion: ACTUALIZATION_CONTRACT_VERSION,
    recordVersion: ACTUALIZATION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Actualization contract surface (W039, in-package full surface): observation intake and typed validation states (insufficient/corroborated/conflicting/resolved), sealed conflict resolutions, exact-revision lineage edges chaining prediction -> baseline -> commitment -> actual -> forecast, rolling completion/cost forecast plan measures, comparison facts and calibration states, and the actualization:* event vocabulary over the W010 event shapes. JSON Schema projection under schemas/; runtime validators in @epoch/actualization.',
    dataTypes: ACTUALIZATION_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, stage-order rules, partition checks, digest verification, tenant checks) are enforced by the runtime validators in @epoch/actualization and are not represented in the JSON Schema files',
    emittedBy:
      'renderActualizationContractFiles() in @epoch/actualization (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

/** Render the `contracts/actualization` public artifact set (core records). */
export function renderActualizationPublicContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of CORE_RECORD_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/actualization',
    contractVersion: ACTUALIZATION_CONTRACT_VERSION,
    recordVersion: ACTUALIZATION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Actualization public contract surface (W039, W012 convention): the CORE record types a domain pack or downstream consumer binds to — the observation reference grammar, reconciliation policies, sealed validation assessments and conflict resolutions, sealed lineage edges over the five lifecycle-first node kinds, comparison facts and calibration states, and the actualization:* events over the W010 event shapes. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: CORE_RECORD_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/actualization and are not represented in the JSON Schema files',
    emittedBy:
      'renderActualizationPublicContractFiles() in @epoch/actualization (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:actualization:${typeToKebabCase(typeName)}:${ACTUALIZATION_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `ValidationAssessmentContent` -> `validation-assessment-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
