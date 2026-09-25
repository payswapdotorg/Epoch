/**
 * Deterministic emission of the published contract artifacts under
 * `contracts/renderers/` (the W002-W004 shared-contracts convention).
 *
 * `renderRendererContractFiles()` is a pure function: it renders the JSON
 * Schema projection (zod 4 `z.toJSONSchema`, draft 2020-12) of every
 * surface entry plus the manifest (with SHA-256 digests of every emitted
 * file) into an ordered map of relative path -> exact file content.
 *
 * The rendered artifacts are committed. The drift test
 * (`test/contract-drift.test.ts`) re-renders and compares byte-for-byte,
 * so committed artifacts can never drift from the implementation schemas.
 * To regenerate after an intentional schema change, run:
 *
 *     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/renderer-runtime test contract-drift
 *
 * JSON Schema fidelity is structural-only: zod refinements (canonical
 * ordering, negotiation consistency) are enforced by the runtime
 * validators and are not represented in the schema files. The manifest
 * records this explicitly.
 */
import { z, type ZodType } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { RENDERER_RUNTIME_SCHEMA_SURFACE } from './surface';
import {
  RENDERER_CONTRACT_VERSION,
  RENDERER_DOCUMENT_KINDS,
  RENDERER_PROTOCOL_VERSION,
} from './version';

/** Repository path of the renderer contract directory. */
export const RENDERER_CONTRACT_DIR = 'contracts/renderers';

/** Render the complete `contracts/renderers` artifact set. */
export function renderRendererContractFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const schemas: Array<{ type: string; file: string; sha256: string }> = [];

  for (const entry of RENDERER_RUNTIME_SCHEMA_SURFACE) {
    const file = `schemas/${typeToKebabCase(entry.type)}.schema.json`;
    const content = renderSchemaFile(entry.schema);
    files[file] = content;
    schemas.push({ type: entry.type, file, sha256: sha256Hex(content) });
  }

  const manifest = {
    contract: 'epoch/renderers',
    contractVersion: RENDERER_CONTRACT_VERSION,
    protocolVersion: RENDERER_PROTOCOL_VERSION,
    description:
      'Typed, versioned, provider-neutral Renderer Runtime hosting-surface contract (W013): abstract renderer descriptors (kind, capabilities, budgets), device-session snapshots over the W011 device vocabulary, negotiated bindings, invocation envelopes, and content-addressed receipts. TypeScript declarations in index.d.ts; JSON Schema projection under schemas/.',
    dataTypes: RENDERER_RUNTIME_SCHEMA_SURFACE.map((entry) => entry.type),
    documentKinds: [...RENDERER_DOCUMENT_KINDS],
    jsonSchemaFidelity:
      'structural-only: zod refinements (canonical set ordering, negotiated-limit consistency) are enforced by the runtime validators in @epoch/renderer-runtime and are not represented in the JSON Schema files',
    emittedBy:
      'renderRendererContractFiles() in @epoch/renderer-runtime (z.toJSONSchema, JSON Schema draft 2020-12); digests are over the exact file bytes',
    schemas,
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

function renderSchemaFile(schema: ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return `${JSON.stringify(jsonSchema, null, 2)}\n`;
}

/** `RendererDescriptor` -> `renderer-descriptor`. */
export function typeToKebabCase(typeName: string): string {
  return typeName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
