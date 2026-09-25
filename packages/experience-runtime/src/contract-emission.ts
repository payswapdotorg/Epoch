/**
 * Deterministic emission of the in-package contract artifacts under
 * `packages/experience-runtime/schemas/` (the W007/W008/W009 in-package
 * convention).
 *
 * `renderExperienceRuntimeContractFiles()` is a pure function: it renders
 * the JSON Schema projection (zod 4 `z.toJSONSchema`, draft 2020-12) of
 * every surface entry plus the manifest (with SHA-256 digests of every
 * emitted file) into an ordered map of relative path -> exact file
 * content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation schemas.
 * To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/experience-runtime test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, cross-field invariants, lifecycle replay) are enforced by the
 * runtime validators and are not represented in the schema files. The
 * manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { EXPERIENCE_RUNTIME_SCHEMA_SURFACE } from './surface';
import {
  EXPERIENCE_RUNTIME_CONTRACT_VERSION,
  EXPERIENCE_RUNTIME_DOCUMENT_KINDS,
  EXPERIENCE_RUNTIME_PROTOCOL_VERSION,
} from './version';

/** Repository path of the experience-runtime in-package contract directory. */
export const EXPERIENCE_RUNTIME_CONTRACT_DIR = 'packages/experience-runtime/schemas';

/** Render the complete `packages/experience-runtime/schemas` artifact set. */
export function renderExperienceRuntimeContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of EXPERIENCE_RUNTIME_SCHEMA_SURFACE) {
    const file = `${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/experience-runtime',
    contractVersion: EXPERIENCE_RUNTIME_CONTRACT_VERSION,
    protocolVersion: EXPERIENCE_RUNTIME_PROTOCOL_VERSION,
    description:
      'Typed, versioned, provider-neutral Experience Runtime host-model contract surface (W013): tenant-scoped device sessions over the W011 device vocabulary, deterministic virtual-time frame/tick schedules, typed runtime events, and a typed session-error taxonomy. JSON Schema projection under schemas/; runtime validators in @epoch/experience-runtime.',
    dataTypes: EXPERIENCE_RUNTIME_SCHEMA_SURFACE.map((entry) => entry.type),
    documentKinds: [...EXPERIENCE_RUNTIME_DOCUMENT_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements (derived-index consistency, lifecycle replay, trace contiguity) are enforced by the runtime validators in @epoch/experience-runtime and are not represented in the JSON Schema files',
    emittedBy:
      'renderExperienceRuntimeContractFiles() in @epoch/experience-runtime (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return `${JSON.stringify(jsonSchema, null, 2)}\n`;
}

/** `DeviceSessionRecord` -> `device-session-record`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
