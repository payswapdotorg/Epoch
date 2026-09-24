/**
 * Deterministic emission of the published contract artifacts under
 * `contracts/actions/` (mirrors `@epoch/agent-protocol`'s emission).
 *
 * `renderActionContractFiles()` is pure; the rendered artifacts are
 * committed; the drift test proves byte-identity. Regenerate with:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/action-protocol test contract-drift
 *
 * JSON Schema fidelity is structural-only (zod refinements are enforced by
 * the runtime validators).
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { ACTION_PROTOCOL_SCHEMA_SURFACE } from './surface';
import {
  ACTION_CONTRACT_VERSION,
  ACTION_PROTOCOL_MESSAGE_KINDS,
  ACTION_PROTOCOL_VERSION,
} from './version';

/** Repository path of the actions contract directory. */
export const ACTION_CONTRACT_DIR = 'contracts/actions';

/** Render the complete `contracts/actions` artifact set. */
export function renderActionContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of ACTION_PROTOCOL_SCHEMA_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const jsonSchema = z.toJSONSchema(entry.schema, { target: 'draft-2020-12' });
    const content = `${JSON.stringify(jsonSchema, null, 2)}\n`;
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/actions',
    contractVersion: ACTION_CONTRACT_VERSION,
    protocolVersion: ACTION_PROTOCOL_VERSION,
    description:
      'Typed, versioned Action Protocol contract surface (W003): proposals and authorization request/decision messages. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: ACTION_PROTOCOL_SCHEMA_SURFACE.map((entry) => entry.type),
    messageKinds: [...ACTION_PROTOCOL_MESSAGE_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements are enforced by the runtime validators in @epoch/action-protocol and are not represented in the JSON Schema files',
    emittedBy:
      'renderActionContractFiles() in @epoch/action-protocol (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

/** `ActionProposal` -> `action-proposal`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// Keep the ZodType import used for documentation clarity in parity tooling.
export type { ZodType };
