/**
 * Deterministic emission of the published contract artifacts under
 * `contracts/agent/`.
 *
 * `renderAgentContractFiles()` is a pure function: it renders the JSON Schema
 * projection (zod 4 `z.toJSONSchema`, draft 2020-12) of every surface entry
 * plus the manifest (with SHA-256 digests of every emitted file) into an
 * ordered map of relative path -> exact file content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte, so
 * committed artifacts can never drift from the implementation schemas. To
 * regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/agent-protocol test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (cross-field
 * invariants) are enforced by the runtime validators and are not represented
 * in the schema files. The manifest records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from './digest';
import { AGENT_PROTOCOL_SCHEMA_SURFACE } from './surface';
import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROTOCOL_MESSAGE_KINDS,
  AGENT_PROTOCOL_VERSION,
} from './version';

/** Repository path of the agent contract directory. */
export const AGENT_CONTRACT_DIR = 'contracts/agent';

/** Render the complete `contracts/agent` artifact set. */
export function renderAgentContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of AGENT_PROTOCOL_SCHEMA_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/agent',
    contractVersion: AGENT_CONTRACT_VERSION,
    protocolVersion: AGENT_PROTOCOL_VERSION,
    description:
      'Typed, versioned, provider-neutral Agent Protocol contract surface (W003). TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: AGENT_PROTOCOL_SCHEMA_SURFACE.map((entry) => entry.type),
    messageKinds: [...AGENT_PROTOCOL_MESSAGE_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/agent-protocol and are not represented in the JSON Schema files',
    emittedBy:
      'renderAgentContractFiles() in @epoch/agent-protocol (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return `${JSON.stringify(jsonSchema, null, 2)}\n`;
}

/** `AgentRegistration` -> `agent-registration`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
