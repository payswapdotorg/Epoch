/**
 * Deterministic emission of the published contract artifacts under
 * `contracts/experience-compiler/`.
 *
 * `renderExperienceCompilerContractFiles()` is a pure function: it
 * renders the JSON Schema projection (zod 4 `z.toJSONSchema`, draft
 * 2020-12) of every surface entry plus the manifest (with SHA-256
 * digests of every emitted file) into an ordered map of relative path ->
 * exact file content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation
 * schemas. To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/experience-compiler test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, anchor resolvability) are enforced
 * by the runtime validators and are not represented in the schema files.
 * The manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { EXPERIENCE_COMPILER_SCHEMA_SURFACE } from './surface';
import {
  EXPERIENCE_COMPILER_CONTRACT_VERSION,
  EXPERIENCE_COMPILER_DOCUMENT_KINDS,
  RENDER_PLAN_PROTOCOL_VERSION,
} from './version';

/** Repository path of the experience-compiler contract directory. */
export const EXPERIENCE_COMPILER_CONTRACT_DIR = 'contracts/experience-compiler';

/** Render the complete `contracts/experience-compiler` artifact set. */
export function renderExperienceCompilerContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of EXPERIENCE_COMPILER_SCHEMA_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/experience-compiler',
    contractVersion: EXPERIENCE_COMPILER_CONTRACT_VERSION,
    protocolVersion: RENDER_PLAN_PROTOCOL_VERSION,
    description:
      'Typed, versioned, provider-neutral Experience Compiler contract surface (W012): deterministic, renderer-ready Render Plans (staged, sorted, device-shaped, tenant-scoped; envelope digest -> plan digest chain). TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: EXPERIENCE_COMPILER_SCHEMA_SURFACE.map((entry) => entry.type),
    documentKinds: [...EXPERIENCE_COMPILER_DOCUMENT_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical stage/op ordering, cross-field invariants, anchor resolvability, usage consistency) are enforced by the runtime validators in @epoch/experience-compiler and are not represented in the JSON Schema files',
    emittedBy:
      'renderExperienceCompilerContractFiles() in @epoch/experience-compiler (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return `${JSON.stringify(jsonSchema, null, 2)}\n`;
}

/** `RenderPlan` -> `render-plan`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
