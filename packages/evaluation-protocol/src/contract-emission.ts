/**
 * Deterministic emission of the published contract artifacts under
 * `packages/evaluation-protocol/contracts/` (the in-package ownership
 * boundary — W005 owns no repository-root `contracts/*` directory).
 *
 * `renderEvaluationContractFiles()` is pure; the rendered artifacts are
 * committed; the drift test proves byte-identity. Regenerate with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/evaluation-protocol test contract-drift
 *
 * JSON Schema fidelity is structural-only (zod refinements are enforced
 * by the runtime validators).
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { EVALUATION_PROTOCOL_SCHEMA_SURFACE } from './surface';
import {
  EVALUATION_CONTRACT_VERSION,
  EVALUATION_PROTOCOL_MESSAGE_KINDS,
  EVALUATION_PROTOCOL_VERSION,
} from './version';

/** Repository path of the evaluation contract directory (in-package). */
export const EVALUATION_CONTRACT_DIR = 'packages/evaluation-protocol/contracts';

/** Render the complete evaluation contract artifact set. */
export function renderEvaluationContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of EVALUATION_PROTOCOL_SCHEMA_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/evaluation',
    contractVersion: EVALUATION_CONTRACT_VERSION,
    protocolVersion: EVALUATION_PROTOCOL_VERSION,
    description:
      'Typed, versioned, provider-neutral Evaluation Protocol contract surface (W005): evaluator registration, evaluation request, and verdict messages with justification references. Published in-package (W005 owns no repository-root contracts directory). TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: EVALUATION_PROTOCOL_SCHEMA_SURFACE.map((entry) => entry.type),
    messageKinds: [...EVALUATION_PROTOCOL_MESSAGE_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/evaluation-protocol and are not represented in the JSON Schema files',
    emittedBy:
      'renderEvaluationContractFiles() in @epoch/evaluation-protocol (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return `${JSON.stringify(jsonSchema, null, 2)}\n`;
}

/** `EvaluatorRegistration` -> `evaluator-registration`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
