/**
 * Deterministic emission of the published contract artifacts under
 * `packages/simulation-protocol/contracts/` (the in-package ownership
 * boundary — W005 owns no repository-root `contracts/*` directory).
 *
 * `renderSimulationContractFiles()` is pure: it renders the JSON Schema
 * projection (zod 4 `z.toJSONSchema`, draft 2020-12) of every surface
 * entry plus the manifest (with SHA-256 digests of every emitted file)
 * into an ordered map of relative path -> exact file content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation schemas.
 * To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/simulation-protocol test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (cross-field
 * invariants) are enforced by the runtime validators and are not
 * represented in the schema files. The manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { SIMULATION_PROTOCOL_SCHEMA_SURFACE } from './surface';
import {
  SIMULATION_CONTRACT_VERSION,
  SIMULATION_PROTOCOL_MESSAGE_KINDS,
  SIMULATION_PROTOCOL_VERSION,
} from './version';

/** Repository path of the simulation contract directory (in-package). */
export const SIMULATION_CONTRACT_DIR = 'packages/simulation-protocol/contracts';

/** Render the complete simulation contract artifact set. */
export function renderSimulationContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of SIMULATION_PROTOCOL_SCHEMA_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/simulation',
    contractVersion: SIMULATION_CONTRACT_VERSION,
    protocolVersion: SIMULATION_PROTOCOL_VERSION,
    description:
      'Typed, versioned, provider-neutral Simulation Protocol contract surface (W005): simulator registration, invocation request, and result messages. Published in-package (W005 owns no repository-root contracts directory). TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: SIMULATION_PROTOCOL_SCHEMA_SURFACE.map((entry) => entry.type),
    messageKinds: [...SIMULATION_PROTOCOL_MESSAGE_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/simulation-protocol and are not represented in the JSON Schema files',
    emittedBy:
      'renderSimulationContractFiles() in @epoch/simulation-protocol (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return `${JSON.stringify(jsonSchema, null, 2)}\n`;
}

/** `SimulatorRegistration` -> `simulator-registration`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
