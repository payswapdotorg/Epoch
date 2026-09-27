/**
 * Deterministic emission of the published contract artifacts.
 *
 * `renderLearningCalibrationContractFiles()` renders the IN-PACKAGE full
 * surface under `packages/learning-calibration/schemas` (the W006/W007/
 * W009/W023/W036/W039 in-package convention);
 * `renderLearningCalibrationPublicContractFiles()` renders the CORE
 * record projection under `contracts/learning-calibration/` (the W012
 * public-contract convention: schemas/ + manifest). Both are pure
 * functions: each schema file is self-contained with a versioned `$id`
 * `urn:epoch:learning-calibration:<name>:<contractVersion>`, and the
 * manifests carry SHA-256 digests of every emitted file, into ordered
 * maps of relative path -> exact file content.
 *
 * The rendered artifacts are COMMITTED. The drift test
 * (test/contract-drift.test.ts) re-renders and compares byte-for-byte, so
 * committed artifacts can never drift from the implementation schemas. To
 * regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/learning-calibration test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, lineage gates, digest verification,
 * tenant checks) are enforced by the runtime validators and are not
 * represented in the schema files. The manifests record this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { LEARNING_CALIBRATION_SCHEMA_SURFACE, CORE_RECORD_SURFACE } from './surface';
import { LEARNING_CALIBRATION_CONTRACT_VERSION, LEARNING_CALIBRATION_RECORD_VERSION } from './version';

/** Repository path of the in-package contract directory. */
export const LEARNING_CALIBRATION_CONTRACT_DIR = 'packages/learning-calibration/schemas';

/** Repository path of the public core-record contract directory (W012 convention). */
export const LEARNING_CALIBRATION_PUBLIC_CONTRACT_DIR = 'contracts/learning-calibration';

/** Render the complete `packages/learning-calibration/schemas` artifact set. */
export function renderLearningCalibrationContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of LEARNING_CALIBRATION_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/learning-calibration',
    contractVersion: LEARNING_CALIBRATION_CONTRACT_VERSION,
    recordVersion: LEARNING_CALIBRATION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Learning Calibration contract surface (W040, in-package full surface): outcome-learning candidates embedding the W039 comparison-fact grammar and W036 outcome records with typed validation/variance evidence, typed eligibility states and exclusion records, sealed prediction-to-outcome datasets with deterministic folds and per-row error/variance features, calibration metric sets (bias / MAE / hit-rate with per-pack and per-variant breakdowns), the model registry (typed revisions with mandatory dataset + changing-observation lineage admitted through proposals), and the learning:* event vocabulary over the W010 event shapes. JSON Schema projection under schemas/; runtime validators in @epoch/learning-calibration.',
    dataTypes: LEARNING_CALIBRATION_SCHEMA_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical ordering, lineage gates, partition checks, digest verification, tenant checks) are enforced by the runtime validators in @epoch/learning-calibration and are not represented in the JSON Schema files',
    emittedBy:
      'renderLearningCalibrationContractFiles() in @epoch/learning-calibration (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

/** Render the `contracts/learning-calibration` public artifact set (core records). */
export function renderLearningCalibrationPublicContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of CORE_RECORD_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.type, entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/learning-calibration',
    contractVersion: LEARNING_CALIBRATION_CONTRACT_VERSION,
    recordVersion: LEARNING_CALIBRATION_RECORD_VERSION,
    description:
      'Typed, versioned, provider-neutral Learning Calibration public contract surface (W040, W012 convention): the CORE record types a domain pack or downstream consumer binds to — outcome-learning candidates, typed exclusion records, sealed prediction-to-outcome datasets and rows with error/variance features and domain-pack context by typed reference, calibration metric sets, the model-registry revisions and proposals with mandatory lineage, and the learning:* events over the W010 event shapes. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: CORE_RECORD_SURFACE.map((entry) => entry.type),
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/learning-calibration and are not represented in the JSON Schema files',
    emittedBy:
      'renderLearningCalibrationPublicContractFiles() in @epoch/learning-calibration (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
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
    $id: `urn:epoch:learning-calibration:${typeToKebabCase(typeName)}:${LEARNING_CALIBRATION_CONTRACT_VERSION}`,
  };
  return `${JSON.stringify(withId, null, 2)}\n`;
}

/** `CalibrationMetricSetContent` -> `calibration-metric-set-content`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
